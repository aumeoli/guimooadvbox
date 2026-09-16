const config = require('./config');

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

// AdvBox espera número local com DDD, sem código do país (55/+).
function normalizePhone(value) {
  let digits = digitsOnly(value);
  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  return digits || undefined;
}

/**
 * GET /crm/negociacoes/{id}/campos-personalizados retorna um array de
 * {id_campo_personalizado, nome, tipo, valor, ...}. Reduz para um mapa
 * {id_campo_personalizado: valor} para consulta pelos IDs em config.guimooFieldIds.
 */
function extractCustomFieldValues(rawFields) {
  const map = {};
  for (const field of rawFields || []) {
    map[field.id_campo_personalizado] = field.valor;
  }
  return map;
}

function getCpf(customFields) {
  return customFields[config.guimooFieldIds.cpf];
}

/** Monta o payload de POST /customers a partir do contato (GET /crm/contatos/{id}) da Guimoo. */
function mapContatoToCustomer(contato, cpf) {
  const name = contato.nome;
  if (!name) {
    throw new Error(`Contato Guimoo #${contato.Id} sem nome.`);
  }

  return {
    users_id: config.advbox.usersId,
    customers_origins_id: config.advbox.customersOriginsId,
    name,
    email: contato.Email || contato.email || undefined,
    cellphone: normalizePhone(contato.telefone),
    identification: cpf,
    notes: `Lead capturado no Guimoo (contato #${contato.Id})`,
  };
}

/**
 * Monta o payload de POST /lawsuits resolvendo stages_id e type_lawsuits_id
 * a partir dos campos personalizados da negociação (Fase/Etapa e Grupo de
 * ação/Tipo de ação), comparados com GET /settings da AdvBox (ver
 * src/settingsCache.js). Lança erro claro se algum não for encontrado —
 * melhor falhar visivelmente do que criar o processo com a fase/tipo errado.
 */
function mapToLawsuit(customersId, customFields, negociacao, settings, { findStageId, findTypeLawsuitId }) {
  const fase = customFields[config.guimooFieldIds.fase];
  const etapa = customFields[config.guimooFieldIds.etapa];
  const grupoAcao = customFields[config.guimooFieldIds.grupoAcao];
  const tipoAcao = customFields[config.guimooFieldIds.tipoAcao];

  const stagesId = findStageId(settings, { fase, etapa });
  const typeLawsuitsId = findTypeLawsuitId(settings, { grupo: grupoAcao, tipo: tipoAcao });

  const missing = [];
  if (!stagesId) missing.push(`Fase/Etapa (recebido: "${fase}" / "${etapa}")`);
  if (!typeLawsuitsId) missing.push(`Grupo de ação/Tipo de ação (recebido: "${grupoAcao}" / "${tipoAcao}")`);
  if (missing.length) {
    throw new Error(`Não foi possível resolver na AdvBox: ${missing.join('; ')}. Confira GET /settings.`);
  }

  return {
    users_id: config.advbox.usersId,
    customers_id: [customersId],
    stages_id: stagesId,
    type_lawsuits_id: typeLawsuitsId,
    folder: (negociacao?.titulo || '').slice(0, 30) || undefined,
    date: new Date().toISOString().slice(0, 10),
  };
}

module.exports = { extractCustomFieldValues, getCpf, mapContatoToCustomer, mapToLawsuit };
