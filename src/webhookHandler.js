const config = require('./config');
const advbox = require('./advboxClient');
const guimoo = require('./guimooClient');
const settingsCache = require('./settingsCache');
const { extractCustomFieldValues, getCpf, mapContatoToCustomer, mapToLawsuit } = require('./mapping');

// O webhook "Nova Movimentação" da Guimoo só informa o estágio (sem funil) — ver README.
function isTargetStage(estagioNovo) {
  if (!estagioNovo) return false;
  const idMatches = config.guimoo.targetStageId && String(estagioNovo.id) === String(config.guimoo.targetStageId);
  const nameMatches =
    config.guimoo.targetStageName &&
    estagioNovo.nome &&
    estagioNovo.nome.toLowerCase() === config.guimoo.targetStageName.toLowerCase();
  return Boolean(idMatches || nameMatches);
}

async function findCustomerIdByCpf(cpf) {
  const found = await advbox.findCustomers({ identification: cpf });
  return found?.data?.[0]?.id ?? null;
}

async function resolveCustomerId(idContato, cpf) {
  const existingId = await findCustomerIdByCpf(cpf);
  if (existingId) return existingId;

  const contato = await guimoo.getContato(idContato);
  const customerPayload = mapContatoToCustomer(contato, cpf);
  try {
    const result = await advbox.createCustomer(customerPayload);
    return result.customers_id;
  } catch (err) {
    // Corrida rara: outro processo pode ter criado o mesmo CPF entre a consulta e a criação.
    const isDuplicate = err instanceof advbox.AdvboxApiError && err.status === 422 && err.body?.errors?.duplicate;
    if (!isDuplicate) throw err;
    const idAfterRace = await findCustomerIdByCpf(cpf);
    if (!idAfterRace) throw err;
    return idAfterRace;
  }
}

async function handleGuimooWebhook(req, res) {
  if (config.guimoo.webhookSecret) {
    const receivedSecret = req.get('x-webhook-secret');
    if (receivedSecret !== config.guimoo.webhookSecret) {
      return res.status(401).json({ error: 'invalid webhook secret' });
    }
  }

  const { id_negociacao: idNegociacao, id_contato: idContato, estagio_novo: estagioNovo } = req.body;

  if (!isTargetStage(estagioNovo)) {
    return res.status(200).json({ ignored: true, reason: 'negociação não está na etapa configurada' });
  }

  try {
    const customFieldsRaw = await guimoo.getNegociacaoCamposPersonalizados(idNegociacao);
    const customFields = extractCustomFieldValues(customFieldsRaw);

    const cpf = getCpf(customFields);
    if (!cpf) {
      throw new Error(`Negociação #${idNegociacao} sem o campo personalizado CPF preenchido.`);
    }

    const customersId = await resolveCustomerId(idContato, cpf);

    const [negociacao, settings] = await Promise.all([guimoo.getNegociacao(idNegociacao), settingsCache.getSettings()]);
    const lawsuitPayload = mapToLawsuit(customersId, customFields, negociacao, settings, settingsCache);
    const lawsuit = await advbox.createLawsuit(lawsuitPayload);

    return res.status(201).json({
      success: true,
      customers_id: customersId,
      lawsuits_id: lawsuit.lawsuits_id,
    });
  } catch (err) {
    console.error('Erro ao processar negociação do Guimoo:', err);
    const status = err instanceof advbox.AdvboxApiError || err instanceof guimoo.GuimooApiError ? err.status : 422;
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: err.message,
      details: err.body || undefined,
    });
  }
}

module.exports = { handleGuimooWebhook };
