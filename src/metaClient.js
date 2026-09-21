const config = require('./config');

const GRAPH_VERSION = 'v26.0';
// A Meta reporta o mesmo evento de "nova conversa de WhatsApp" sob os dois
// action_types abaixo, com o mesmo valor — usa o primeiro que existir por
// linha, NUNCA soma os dois (senão duplica a contagem).
const MESSAGING_ACTION_TYPES = [
  'onsite_conversion.total_messaging_connection',
  'onsite_conversion.messaging_conversation_started_7d',
];

/**
 * Soma conversas iniciadas e gasto da Meta Ads na janela [start, end)
 * (objetos Date), usando breakdown por hora no fuso da conta de anúncios.
 */
async function getConversasNaJanela(start, end) {
  const act = config.meta.adAccountId.startsWith('act_')
    ? config.meta.adAccountId
    : `act_${config.meta.adAccountId}`;
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${act}/insights`);
  url.searchParams.set('level', 'account');
  url.searchParams.set('breakdowns', 'hourly_stats_aggregated_by_advertiser_time_zone');
  url.searchParams.set(
    'time_range',
    JSON.stringify({ since: toDateStr(start), until: toDateStr(end) }),
  );
  url.searchParams.set('fields', 'spend,actions');
  url.searchParams.set('limit', '500');
  url.searchParams.set('access_token', config.meta.accessToken);

  let totalMsgs = 0;
  let totalSpend = 0;
  let nextUrl = url.toString();

  while (nextUrl) {
    const res = await fetch(nextUrl);
    const data = await res.json();
    if (data.error) {
      throw new Error(`Meta Graph API error: ${JSON.stringify(data.error)}`);
    }
    for (const row of data.data || []) {
      const hourLabel = row.hourly_stats_aggregated_by_advertiser_time_zone;
      const hourStart = hourLabel ? hourLabel.split(' - ')[0] : null;
      if (!hourStart) continue;
      const rowDate = row.date_start || toDateStr(start);
      const rowDt = new Date(`${rowDate}T${hourStart}${tzOffsetSuffix()}`);
      if (!(rowDt >= start && rowDt < end)) continue;

      totalSpend += parseFloat(row.spend || 0);
      const actionsByType = {};
      for (const a of row.actions || []) actionsByType[a.action_type] = a.value;
      for (const candidate of MESSAGING_ACTION_TYPES) {
        if (candidate in actionsByType) {
          totalMsgs += parseInt(actionsByType[candidate], 10) || 0;
          break;
        }
      }
    }
    nextUrl = data.paging?.next || null;
  }

  return { conversas: totalMsgs, gasto: Math.round(totalSpend * 100) / 100 };
}

function toDateStr(d) {
  // data no fuso configurado (America/Manaus), não UTC
  return d.toLocaleDateString('en-CA', { timeZone: config.dailyReport.timezone });
}

function tzOffsetSuffix() {
  // America/Manaus é UTC-4 o ano todo (sem horário de verão desde 2019).
  return '-04:00';
}

module.exports = { getConversasNaJanela };
