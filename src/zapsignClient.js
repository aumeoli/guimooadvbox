const config = require('./config');

class ZapsignApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ZapsignApiError';
    this.status = status;
    this.body = body;
  }
}

async function request(method, path, { query } = {}) {
  const url = new URL(config.zapsign.baseUrl + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.zapsign.token}`,
      Accept: 'application/json',
    },
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ZapsignApiError(`ZapSign ${method} ${path} -> ${res.status}`, res.status, data);
  }
  return data;
}

/** GET /docs/ paginado — todos os documentos criados no intervalo, com signatários. */
async function listDocsWithSigners({ createdFrom, createdTo }) {
  const all = [];
  let page = 1;
  while (true) {
    const data = await request('GET', '/docs/', {
      query: { created_from: createdFrom, created_to: createdTo, include_signers: 'true', page },
    });
    const results = data.results || [];
    all.push(...results);
    if (!data.next) break;
    page += 1;
  }
  return all;
}

module.exports = { ZapsignApiError, listDocsWithSigners };
