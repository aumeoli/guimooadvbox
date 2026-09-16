const config = require('./config');

class AdvboxApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'AdvboxApiError';
    this.status = status;
    this.body = body;
  }
}

async function request(method, path, { query, body } = {}) {
  const url = new URL(config.advbox.baseUrl + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.advbox.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // Sem User-Agent de navegador, a proteção Cloudflare da AdvBox responde
      // 403 (HTML) em vez do JSON de erro documentado — não é falha de auth.
      'User-Agent': 'Mozilla/5.0 (compatible; guimoo-advbox-integration)',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new AdvboxApiError(`AdvBox ${method} ${path} -> ${res.status}`, res.status, data);
  }
  return data;
}

/** GET /settings — IDs de referência da conta (users, origins, stages, lawsuit_types, ...) */
function getSettings() {
  return request('GET', '/settings');
}

/** GET /customers com filtros — usado para achar um contato já existente em caso de duplicidade */
function findCustomers(query) {
  return request('GET', '/customers', { query });
}

/** POST /customers — cria um novo contato. Retorna { success, customers_id }. */
function createCustomer(payload) {
  return request('POST', '/customers', { body: payload });
}

/** POST /lawsuits — cria um novo processo. Retorna { success, lawsuits_id }. */
function createLawsuit(payload) {
  return request('POST', '/lawsuits', { body: payload });
}

module.exports = {
  AdvboxApiError,
  getSettings,
  findCustomers,
  createCustomer,
  createLawsuit,
};
