# Integração Guimoo → AdvBox

Quando uma negociação entra na etapa **"ADVBOX"** (funil "Vendas Realizadas") no
Guimoo, este serviço:

1. Recebe o webhook "Nova Movimentação" (`POST /webhooks/guimoo`).
2. Confere se o estágio novo é o configurado (`estagio_novo.id`/`nome`).
3. Busca os campos personalizados da negociação na Guimoo (CPF, Grupo de
   ação, Tipo de ação, Fase, Etapa).
4. Cria o contato na AdvBox (`POST /customers`) — ou reaproveita um já
   existente com o mesmo CPF.
5. Cria o processo na AdvBox (`POST /lawsuits`), resolvendo `stages_id` e
   `type_lawsuits_id` a partir de Fase/Etapa e Grupo/Tipo de ação.

## Por que buscar dados de volta na Guimoo?

O payload do webhook "Nova Movimentação" só traz IDs:

```json
{
  "id_negociacao": 3270166,
  "id_contato": 2680055,
  "id_usuario": 17928,
  "id_fonte": 17762,
  "id_anuncio": null,
  "estagio_anterior": { "id": 72665, "nome": "ENTREGUE AO JURÍDICO" },
  "estagio_novo": { "id": 82092, "nome": "ADVBOX" }
}
```

Nenhum campo personalizado ou dado de contato vem nele — por isso o serviço
faz 3 chamadas de leitura à API da Guimoo por evento:

- `GET /crm/negociacoes/{id_negociacao}` — título da negociação (usado como `folder`).
- `GET /crm/negociacoes/{id_negociacao}/campos-personalizados` — valores de CPF, Grupo/Tipo de ação, Fase/Etapa.
- `GET /crm/contatos/{id_contato}` — nome, email, telefone (só quando o contato ainda não existe na AdvBox).

Esses 3 endpoints **não estavam na documentação oficial** compartilhada —
foram descobertos testando a API real (ver [`src/guimooClient.js`](src/guimooClient.js)).

## Mapeamento de campos

| Campo personalizado Guimoo (id) | Usado em | Campo AdvBox |
|---|---|---|
| CPF (8919) | busca/criação do contato | `identification` |
| Fase (8904) + Etapa (8905) | processo | `stages_id` (via `stages[].step`+`stages[].stage` em `GET /settings`) |
| Grupo de ação (8902) + Tipo de ação (8903) | processo | `type_lawsuits_id` (via `lawsuit_types[].group`+`lawsuit_types[].type`) |

A resolução de `stages_id`/`type_lawsuits_id` é **dinâmica**: o texto vindo da
Guimoo é comparado (case-insensitive) com `GET /settings` da AdvBox a cada
requisição (`src/settingsCache.js`, cacheado em memória por processo). Se o
texto não bater com nada, a requisição falha com um erro claro em vez de
criar o processo na fase/tipo errado.

⚠️ O campo CPF é do tipo `INTEGER` na Guimoo — se algum CPF começar com zero,
o valor pode ter perdido esse zero. Vale confirmar com casos reais.

## Setup

```bash
npm install
cp .env.example .env
```

Preencha no `.env` (a maioria já vem preenchida com os valores confirmados
nesta conta — confira antes de usar em outra conta):

- `ADVBOX_TOKEN`, `GUIMOO_API_KEY` — nunca comitar; ficam só no `.env` local.
- `ADVBOX_USERS_ID`, `ADVBOX_CUSTOMERS_ORIGINS_ID` — responsável e origem
  padrão para contatos/processos criados por esta automação (rode
  `npm run settings` para listar as opções da sua conta).
- `GUIMOO_TARGET_STAGE_ID` / `GUIMOO_TARGET_STAGE_NAME` — etapa que dispara a automação.
- `GUIMOO_FIELD_ID_*` — IDs dos campos personalizados (defaults já corretos para esta conta).

Suba o servidor:

```bash
npm start        # produção
npm run dev      # com reload automático
```

## Configurando o webhook no Guimoo

Painel do Guimoo → **Webhooks → Saída → Nova Movimentação** → cole a URL:

```
POST https://SEU_HOST/webhooks/guimoo
```

Esse evento dispara em **toda** mudança de estágio, de qualquer negociação —
o filtro pela etapa "ADVBOX" é feito aqui no serviço (`isTargetStage` em
`src/webhookHandler.js`), não no Guimoo.

Para testar sem hospedar nada ainda, use uma URL temporária do
[webhook.site](https://webhook.site) e inspecione o payload recebido, ou
aponte direto para `http://localhost:3000/webhooks/guimoo` com um túnel
(ngrok, cloudflared) enquanto testa localmente.

Opcionalmente, defina `GUIMOO_WEBHOOK_SECRET` no `.env` e configure o Guimoo
para enviar esse mesmo valor no header `X-Webhook-Secret` (se o painel do
Guimoo permitir headers customizados no webhook).

## Testando localmente

```bash
curl -X POST http://localhost:3000/webhooks/guimoo \
  -H "Content-Type: application/json" \
  -d '{
    "id_negociacao": 3270166,
    "id_contato": 2680055,
    "estagio_novo": { "id": 82092, "nome": "ADVBOX" }
  }'
```

(Usa dados reais de teste desta conta — troque pelos IDs de uma negociação
sua com os campos personalizados preenchidos.)

## Segurança dos tokens

A AdvBox e a Guimoo pedem que os tokens nunca sejam expostos em código-fonte,
versionados no Git ou colados em conversas com IA. Neste projeto eles só
devem existir no arquivo `.env` local (já ignorado pelo `.gitignore`).

## Nota sobre a AdvBox e Cloudflare

A API da AdvBox está atrás de proteção Cloudflare que bloqueia requisições
sem um `User-Agent` de navegador (retorna 403 com HTML, não o JSON de erro
documentado). O cliente em `src/advboxClient.js` já envia um `User-Agent`
fixo por esse motivo — não remova esse header.
