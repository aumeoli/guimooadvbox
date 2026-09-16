// Roda GET /settings na AdvBox e imprime os IDs necessários para preencher o .env.
// Uso: npm run settings

const advbox = require('../src/advboxClient');

async function main() {
  const settings = await advbox.getSettings();

  console.log('\n=== users (ADVBOX_USERS_ID) ===');
  for (const u of settings.users) console.log(`${u.id}\t${u.name}`);

  console.log('\n=== origins (ADVBOX_CUSTOMERS_ORIGINS_ID) ===');
  for (const o of settings.origins) console.log(`${o.id}\t${o.origin}`);

  console.log('\n=== stages (ADVBOX_STAGES_ID) ===');
  for (const s of settings.stages) console.log(`${s.id}\t${s.stage}\t(step: ${s.step})`);

  console.log('\n=== lawsuit_types (ADVBOX_TYPE_LAWSUITS_ID) ===');
  for (const t of settings.lawsuit_types) console.log(`${t.id}\t${t.type}\t(grupo: ${t.group})`);

  console.log('\nCopie os IDs desejados para o seu .env.');
}

main().catch((err) => {
  console.error('Falha ao consultar /settings:', err.message, err.body || '');
  process.exit(1);
});
