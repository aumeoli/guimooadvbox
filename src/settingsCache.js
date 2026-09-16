const advbox = require('./advboxClient');

let cached = null;

// GET /settings raramente muda — busca uma vez por processo e reaproveita.
// Se você renomear fases/tipos de processo na AdvBox, reinicie o serviço.
async function getSettings() {
  if (!cached) {
    cached = await advbox.getSettings();
  }
  return cached;
}

function normalize(value) {
  return String(value ?? '').trim().toUpperCase();
}

/** Resolve stages_id a partir de "Fase" (stages[].step) e/ou "Etapa" (stages[].stage) do card. */
function findStageId(settings, { fase, etapa }) {
  let candidates = settings.stages;
  if (etapa) {
    candidates = candidates.filter((s) => normalize(s.stage) === normalize(etapa));
  }
  if (fase && candidates.length !== 1) {
    candidates = candidates.filter((s) => normalize(s.step) === normalize(fase));
  }
  return candidates[0]?.id ?? null;
}

/** Resolve type_lawsuits_id a partir de "Tipo de ação" (lawsuit_types[].type) e/ou "Grupo de ação" (lawsuit_types[].group). */
function findTypeLawsuitId(settings, { grupo, tipo }) {
  let candidates = settings.lawsuit_types;
  if (tipo) {
    candidates = candidates.filter((t) => normalize(t.type) === normalize(tipo));
  }
  if (grupo && candidates.length !== 1) {
    candidates = candidates.filter((t) => normalize(t.group) === normalize(grupo));
  }
  return candidates[0]?.id ?? null;
}

module.exports = { getSettings, findStageId, findTypeLawsuitId };
