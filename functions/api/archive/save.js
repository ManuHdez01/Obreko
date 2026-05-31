// POST /api/archive/save — guarda snapshot HTML de una propuesta en R2
// Llamado desde _crm-button.js tras crear el deal en HubSpot.
// No requiere sesión porque es la misma acción que Guardar en CRM.

export async function onRequestPost({ request, env }) {
  if (!env.ARCHIVE) {
    return json({ error: 'Bucket R2 no configurado' }, 503);
  }
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const html = String(payload.html || '');
  if (!html || html.length < 500) {
    return json({ error: 'HTML vacío o demasiado corto' }, 400);
  }
  if (html.length > 5 * 1024 * 1024) {
    return json({ error: 'HTML demasiado grande (> 5 MB)' }, 413);
  }

  const meta = payload.meta || {};
  const ref = sanitizeKey(meta.ref || 'sin-ref');
  const slug = sanitizeKey(meta.slug || 'propuesta');
  const clientName = String(meta.clientName || '').slice(0, 200);
  const type = String(meta.type || slug).slice(0, 80);
  const amount = Number(meta.amount) || 0;
  const email = String(meta.email || '').slice(0, 200);
  const phone = String(meta.phone || '').slice(0, 80);
  const hubspotDealId = String(meta.hubspotDealId || '').slice(0, 50);

  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const time = now.toISOString().replace(/[:.]/g, '-');

  // ID corto y único por propuesta (para URLs amigables)
  const id = `${yyyy}${mm}${dd}-${slug}-${ref}-${time.slice(11, 19)}`.replace(/[^A-Za-z0-9_-]/g, '-');
  const key = `proposals/${yyyy}/${mm}/${id}.html`;

  const customMetadata = {
    ref,
    slug,
    type,
    client: clientName,
    amount: String(amount),
    email,
    phone,
    savedAt: now.toISOString(),
    hubspotDealId,
  };
  // R2 metadata values must be ASCII; limpiamos acentos
  const cleanMetadata = {};
  for (const [k, v] of Object.entries(customMetadata)) {
    cleanMetadata[k] = toAsciiSafe(String(v)).slice(0, 500);
  }

  await env.ARCHIVE.put(key, html, {
    httpMetadata: {
      contentType: 'text/html; charset=utf-8',
      contentLanguage: 'es',
    },
    customMetadata: cleanMetadata,
  });

  return json({
    ok: true,
    id,
    key,
    url: `/archivo/${id}`,
    savedAt: now.toISOString(),
  });
}

function sanitizeKey(s) {
  return String(s).trim().replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 80) || 'x';
}
function toAsciiSafe(s) {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '?');
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
