const express = require('express');
const config = require('./config');
const { handleGuimooWebhook } = require('./webhookHandler');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/webhooks/guimoo', handleGuimooWebhook);

app.listen(config.port, () => {
  console.log(`Integração Guimoo -> AdvBox rodando na porta ${config.port}`);
});
