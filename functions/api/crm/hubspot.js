// Cloudflare Pages Function — POST /api/crm/hubspot
// Crea (o actualiza) un Contact en HubSpot, después crea un Deal
// asociado en el pipeline "Propuestas obreko".
//
// Body esperado (JSON):
//   {
//     "proposal": "reformas" | "adecuacion" | ... ,     // tipo
//     "proposalTitle": "Reforma integral residencial",  // label humano
//     "proposalRef": "REF-2026-REF-001",
//     "proposalUrl": "https://obreko.pages.dev/propuestas/reformas",
//     "client": {
//       "name": "Juan Pérez",
//       "email": "juan@example.com",   // opcional pero ideal
//       "phone": "+34...",             // opcional
//       "address": "Calle Mayor 1..."  // opcional
//     },
//     "amount": 12500.50,              // importe del presupuesto
//     "stage": "borrador"              // opcional, default "borrador"
//   }

const STAGE_MAP = {
  borrador:    'appointmentscheduled',
  enviada:     'qualifiedtobuy',
  vista:       'presentationscheduled',
  negociando:  'decisionmakerboughtin',
  aceptada:    'contractsent',
  firmada:     'closedwon',
  rechazada:   'closedlost',
};

const HUB_BASE = 'https://api.hubapi.com';

export async function onRequestPost({ request, env }) {
  if (!env.HUBSPOT_TOKEN) return json({ error: 'HUBSPOT_TOKEN no configurado' }, 503);

  let payload;
  try { payload = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }

  const client = payload.client || {};
  const name = String(client.name || '').trim();
  if (!name) return json({ error: 'Falta client.name' }, 400);

  const email = String(client.email || '').trim().toLowerCase();
  const phone = String(client.phone || '').trim();
  const address = String(client.address || '').trim();

  const proposal = String(payload.proposal || '').trim();
  const proposalTitle = String(payload.proposalTitle || proposal).trim();
  const proposalRef = String(payload.proposalRef || '').trim();
  const proposalUrl = String(payload.proposalUrl || '').trim();
  const amount = Number(payload.amount) || 0;
  const amountSinIva = Number(payload.amountSinIva) || 0;
  const frequency = String(payload.frequency || 'one_time').trim();
  const tipo = String(payload.tipo || 'one_off').trim();
  const stageKey = String(payload.stage || 'borrador').toLowerCase();
  const stageId = STAGE_MAP[stageKey] || STAGE_MAP.borrador;

  const VALID_FREQ = ['one_time','monthly','quarterly','biannual','yearly'];
  const VALID_TIPO = ['one_off','recurring'];
  const freqVal = VALID_FREQ.includes(frequency) ? frequency : 'one_time';
  const tipoVal = VALID_TIPO.includes(tipo) ? tipo : 'one_off';

  const hubHeaders = {
    'Authorization': `Bearer ${env.HUBSPOT_TOKEN}`,
    'Content-Type': 'application/json',
  };

  // 1. Buscar o crear el Contact.
  //    Si hay email → buscar por email. Si ya existe → usar ese. Si no → crear.
  //    Si no hay email → crear siempre uno nuevo (no podemos deduplicar sin email).
  let contactId = null;
  let contactCreated = false;
  const firstName = name.split(' ')[0];
  const lastName = name.split(' ').slice(1).join(' ') || '';

  if (email) {
    // search by email
    const searchRes = await fetch(`${HUB_BASE}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: hubHeaders,
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
        properties: ['email', 'firstname', 'lastname'],
        limit: 1,
      }),
    });
    const searchJson = await searchRes.json().catch(() => ({}));
    if (searchRes.ok && searchJson.results && searchJson.results.length > 0) {
      contactId = searchJson.results[0].id;
    }
  }

  if (!contactId) {
    // create contact
    const cres = await fetch(`${HUB_BASE}/crm/v3/objects/contacts`, {
      method: 'POST',
      headers: hubHeaders,
      body: JSON.stringify({
        properties: {
          ...(email ? { email } : {}),
          firstname: firstName,
          ...(lastName ? { lastname: lastName } : {}),
          ...(phone ? { phone } : {}),
          ...(address ? { address } : {}),
        },
      }),
    });
    const cjson = await cres.json().catch(() => ({}));
    if (!cres.ok) return json({ error: 'HubSpot rechazó al crear Contact', status: cres.status, details: cjson }, 502);
    contactId = cjson.id;
    contactCreated = true;
  }

  // 2. Crear el Deal y asociarlo al Contact.
  const dealName = proposalRef
    ? `${proposalRef} · ${name}`
    : `${proposalTitle} · ${name}`;

  const closeDate = new Date();
  closeDate.setDate(closeDate.getDate() + 30); // propuesta caduca en 30 días por defecto

  const dealProps = {
    dealname: dealName,
    pipeline: 'default',
    dealstage: stageId,
    closedate: closeDate.toISOString(),
    frecuencia_facturacion: freqVal,
    tipo_servicio: tipoVal,
  };
  if (amount > 0) dealProps.amount = String(amount);
  if (amountSinIva > 0) dealProps.importe_sin_iva = String(amountSinIva);

  const dealBody = {
    properties: dealProps,
    associations: [
      {
        to: { id: contactId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }], // 3 = deal_to_contact primary
      },
    ],
  };

  const dres = await fetch(`${HUB_BASE}/crm/v3/objects/deals`, {
    method: 'POST',
    headers: hubHeaders,
    body: JSON.stringify(dealBody),
  });
  const djson = await dres.json().catch(() => ({}));
  if (!dres.ok) return json({ error: 'HubSpot rechazó al crear Deal', status: dres.status, details: djson }, 502);

  // 3. Añadir nota con la URL de la propuesta, si la hay
  if (proposalUrl) {
    const noteTs = Date.now();
    const noteBody = {
      properties: {
        hs_timestamp: noteTs,
        hs_note_body: `Propuesta creada desde obreko.pages.dev:<br><a href="${proposalUrl}">${proposalUrl}</a>${proposalRef ? `<br>Ref: ${proposalRef}` : ''}`,
      },
      associations: [
        { to: { id: djson.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }] }, // 214 = note_to_deal
        { to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }, // 202 = note_to_contact
      ],
    };
    // si falla la nota, no abortamos todo
    await fetch(`${HUB_BASE}/crm/v3/objects/notes`, {
      method: 'POST',
      headers: hubHeaders,
      body: JSON.stringify(noteBody),
    }).catch(() => null);
  }

  const portalId = djson.portalId || env.HUBSPOT_PORTAL_ID || '51380735';
  const dealUrl = `https://app.hubspot.com/contacts/${portalId}/record/0-3/${djson.id}`;

  return json({
    ok: true,
    dealId: djson.id,
    contactId,
    contactCreated,
    dealUrl,
    stage: stageKey,
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
