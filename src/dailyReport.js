const config = require('./config');
const guimoo = require('./guimooClient');
const zapsign = require('./zapsignClient');
const advbox = require('./advboxClient');
const meta = require('./metaClient');

// America/Manaus é UTC-4 o ano todo (sem horário de verão desde 2019).
const TZ_OFFSET_HOURS = 4;

/**
 * Janela de 24h terminando às 18h (America/Manaus) do dia de referência:
 * 18:00:01 do dia anterior até 18:00:00 do dia de referência.
 * `refDateStr` (YYYY-MM-DD) é opcional — usa "agora" se omitido.
 */
function getWindow(refDateStr) {
  let end;
  if (refDateStr) {
    end = new Date(`${refDateStr}T${(18 + TZ_OFFSET_HOURS).toString().padStart(2, '0')}:00:00Z`);
  } else {
    end = new Date();
  }
  const start = new Date(end.getTime() - 24 * 3600 * 1000 + 1000);
  return { start, end };
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

async function contarNegociacoesNaJanela(start, end) {
  let page = 1;
  let count = 0;
  while (true) {
    const items = await guimoo.listNegociacoes(page);
    if (!items.length) break;
    let stop = false;
    for (const item of items) {
      const created = new Date(item.CreatedAt);
      if (created < start) {
        stop = true;
        break;
      }
      if (created >= start && created < end) count += 1;
    }
    if (stop) break;
    page += 1;
  }
  return count;
}

async function contarZapsignAssinadosNaJanela(start, end) {
  const createdFrom = toISODate(new Date(start.getTime() - 45 * 24 * 3600 * 1000));
  const createdTo = toISODate(end);
  const docs = await zapsign.listDocsWithSigners({ createdFrom, createdTo });
  let count = 0;
  for (const doc of docs) {
    for (const signer of doc.signers || []) {
      if (signer.status !== 'assinou' || !signer.data_hora_assinatura) continue;
      const signedAt = new Date(signer.data_hora_assinatura);
      if (signedAt >= start && signedAt < end) count += 1;
    }
  }
  return count;
}

async function contarAdvboxProtocoladosNaJanela(start, end) {
  const createdStart = toISODate(new Date(start.getTime() - 90 * 24 * 3600 * 1000));
  const createdEnd = toISODate(end);
  let offset = 0;
  const limit = 1000;
  let count = 0;
  while (true) {
    const data = await advbox.listLawsuits({ created_start: createdStart, created_end: createdEnd, limit, offset });
    const items = data.data || [];
    for (const lawsuit of items) {
      if (!lawsuit.status_closure) continue;
      const closureAt = new Date(lawsuit.status_closure.replace(' ', 'T') + 'Z');
      // status_closure vem no fuso America/Manaus sem indicação — ajusta.
      const closureUtc = new Date(closureAt.getTime() + TZ_OFFSET_HOURS * 3600 * 1000);
      if (closureUtc >= start && closureUtc < end) count += 1;
    }
    if (items.length < limit || offset + limit >= (data.totalCount || 0)) break;
    offset += limit;
  }
  return count;
}

function formatMessage({ start, end, meta: metaResult, crm, zap, advboxCount }) {
  const diasSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const fmtDt = (d) =>
    d.toLocaleString('pt-BR', { timeZone: config.dailyReport.timezone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const diaSemana = diasSemana[new Date(end.getTime() - TZ_OFFSET_HOURS * 3600 * 1000).getUTCDay()];
  const dataFmt = end.toLocaleDateString('pt-BR', { timeZone: config.dailyReport.timezone });

  const linhas = [
    '📊 *Relatório Diário — Alves e Advogados*',
    `${diaSemana}, ${dataFmt} — janela ${fmtDt(start)} → ${fmtDt(end)}`,
    '',
    `🎯 Conversas geradas na Meta: *${metaResult ? metaResult.conversas : '—'}*`,
    `📥 Chegaram no CRM (Guimoo): *${crm}*`,
    `✍️ Contratos assinados (ZapSign): *${zap}*`,
    `⚖️ Processos protocolados (AdvBox): *${advboxCount}*`,
  ];
  if (metaResult) {
    linhas.push('', `💰 Investido em anúncios no período: R$ ${metaResult.gasto.toFixed(2).replace('.', ',')}`);
  }
  return linhas.join('\n');
}

async function buildDailyReport(refDateStr) {
  const { start, end } = getWindow(refDateStr);

  const [metaResult, crm, zap, advboxCount] = await Promise.all([
    meta.getConversasNaJanela(start, end).catch((err) => {
      console.error('Erro Meta:', err);
      return null;
    }),
    contarNegociacoesNaJanela(start, end),
    contarZapsignAssinadosNaJanela(start, end),
    contarAdvboxProtocoladosNaJanela(start, end),
  ]);

  const message = formatMessage({ start, end, meta: metaResult, crm, zap, advboxCount });
  return { start, end, meta: metaResult, crm, zap, advboxCount, message };
}

async function sendDailyReport(refDateStr) {
  const report = await buildDailyReport(refDateStr);
  const results = [];
  for (const number of config.dailyReport.numbers) {
    const result = await guimoo.sendWhatsappText({
      idWhatsapp: config.dailyReport.whatsappIdComercial,
      number,
      text: report.message,
    });
    results.push({ number, result });
  }
  return { ...report, sent: results };
}

module.exports = { getWindow, buildDailyReport, sendDailyReport };
