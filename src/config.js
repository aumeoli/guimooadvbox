require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name} (veja .env.example)`);
  }
  return value;
}

const config = {
  port: Number(process.env.PORT) || 3000,

  advbox: {
    baseUrl: process.env.ADVBOX_BASE_URL || 'https://app.advbox.com.br/api/v1',
    // Só é exigido quando o serviço de fato faz uma chamada à AdvBox,
    // não no boot — assim `npm run settings` ainda dá uma mensagem clara,
    // e o servidor sobe mesmo antes de tudo estar configurado.
    get token() {
      return required('ADVBOX_TOKEN');
    },
    usersId: process.env.ADVBOX_USERS_ID || null,
    customersOriginsId: process.env.ADVBOX_CUSTOMERS_ORIGINS_ID || null,
    // stages_id e type_lawsuits_id NÃO são fixos: são resolvidos por card,
    // a partir dos campos personalizados #8904/#8905 (Fase/Etapa) e
    // #8902/#8903 (Grupo de ação/Tipo de ação), comparados com GET /settings.
  },

  guimoo: {
    baseUrl: process.env.GUIMOO_BASE_URL || 'https://integracao.agendasistemacrm.com.br/api/v1',
    get apiKey() {
      return required('GUIMOO_API_KEY');
    },
    // O webhook de "Nova Movimentação" da Guimoo não informa o funil, só o
    // estágio (estagio_novo.id/nome) — por isso só validamos a etapa.
    targetStageId: process.env.GUIMOO_TARGET_STAGE_ID || null,
    targetStageName: process.env.GUIMOO_TARGET_STAGE_NAME || 'ADVBOX',
    webhookSecret: process.env.GUIMOO_WEBHOOK_SECRET || null,
  },

  // ID dos campos personalizados da negociação no Guimoo (GET /crm/campos-personalizados)
  guimooFieldIds: {
    cpf: Number(process.env.GUIMOO_FIELD_ID_CPF) || 8919,
    grupoAcao: Number(process.env.GUIMOO_FIELD_ID_GRUPO_ACAO) || 8902,
    tipoAcao: Number(process.env.GUIMOO_FIELD_ID_TIPO_ACAO) || 8903,
    fase: Number(process.env.GUIMOO_FIELD_ID_FASE) || 8904,
    etapa: Number(process.env.GUIMOO_FIELD_ID_ETAPA) || 8905,
  },
};

module.exports = config;
