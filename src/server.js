const express = require('express');
const cron = require('node-cron');
const config = require('./config');
const { handleGuimooWebhook } = require('./webhookHandler');
const { buildDailyReport, sendDailyReport } = require('./dailyReport');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/webhooks/guimoo', handleGuimooWebhook);

// Disparo manual/teste do relatório diário — protegido por DAILY_REPORT_SECRET.
// ?dry=true monta e retorna a mensagem sem enviar; ?date=YYYY-MM-DD simula outro dia.
app.get('/daily-report/run', async (req, res) => {
  if (config.dailyReport.triggerSecret && req.query.secret !== config.dailyReport.triggerSecret) {
    return res.status(401).json({ error: 'secret inválido ou ausente (?secret=)' });
  }
  try {
    const dry = req.query.dry === 'true';
    const report = dry ? await buildDailyReport(req.query.date) : await sendDailyReport(req.query.date);
    return res.json(report);
  } catch (err) {
    console.error('Erro no relatório diário:', err);
    return res.status(500).json({ error: err.message });
  }
});

if (config.dailyReport.numbers.length && config.dailyReport.whatsappIdComercial) {
  cron.schedule(
    config.dailyReport.cron,
    async () => {
      try {
        const report = await sendDailyReport();
        console.log(`Relatório diário enviado para ${report.sent.length} número(s).`);
      } catch (err) {
        console.error('Falha ao enviar relatório diário:', err);
      }
    },
    { timezone: config.dailyReport.timezone },
  );
  console.log(`Relatório diário agendado: "${config.dailyReport.cron}" (${config.dailyReport.timezone})`);
} else {
  console.log('Relatório diário NÃO agendado — faltam DAILY_REPORT_NUMBERS ou GUIMOO_WHATSAPP_ID_COMERCIAL.');
}

app.listen(config.port, () => {
  console.log(`Integração Guimoo -> AdvBox rodando na porta ${config.port}`);
});
