const config = require('./config');

class GuimooApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'GuimooApiError';
    this.status = status;
    this.body = body;
  }
}

async function request(method, path, { query } = {}) {
  const url = new URL(config.guimoo.baseUrl + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.guimoo.apiKey}`,
      'X-API-Key': config.guimoo.apiKey,
      Accept: 'application/json',
    },
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok || data?.status === 'error') {
    throw new GuimooApiError(`Guimoo ${method} ${path} -> ${res.status}`, res.status, data);
  }
  return data.data;
}

/** GET /crm/negociacoes/{id} — dados da negociação (título, funil, estágio, contato, ...) */
function getNegociacao(id) {
  return request('GET', `/crm/negociacoes/${id}`).then((data) => (Array.isArray(data) ? data[0] : data));
}

/** GET /crm/contatos/{id} — dados do contato (nome, email, telefone) */
function getContato(id) {
  return request('GET', `/crm/contatos/${id}`);
}

/** GET /crm/negociacoes/{id}/campos-personalizados — valores dos campos personalizados dessa negociação */
function getNegociacaoCamposPersonalizados(id) {
  return request('GET', `/crm/negociacoes/${id}/campos-personalizados`);
}

/** GET /crm/campos-personalizados — definições (id, nome, tipo) de todos os campos personalizados do cliente */
function getCamposPersonalizadosDefinitions() {
  return request('GET', '/crm/campos-personalizados');
}

module.exports = {
  GuimooApiError,
  getNegociacao,
  getContato,
  getNegociacaoCamposPersonalizados,
  getCamposPersonalizadosDefinitions,
};
