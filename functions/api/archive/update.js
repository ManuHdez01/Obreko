// POST /api/archive/update — sobreescribe el snapshot HTML de una propuesta archivada.
// Requiere sesión válida (cookie HMAC). El id se busca en proposals/AAAA/MM/<id>.html.

import { verifySession } from './_auth.js';

export async function onRequestPost({ request, env }) {
  if (!(await verifySession(request, env))) {
    return json({ error: 'No autenticado' }, 401);
  }
  if (!env.ARCHIVE) {
    return json({ error: 'Bucket R2 no configurado' }, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const id = String(payload.id || '');
  const html = String(payload.html || '');
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
    return json({ error: 'ID inválido' }, 400);
  }
  if (!html || html.length < 500) {
    return json({ error: 'HTML vacío o demasiado corto' }, 400);
  }
  if (html.length > 5 * 1024 * 1024) {
    return json({ error: 'HTML demasiado grande (> 5 MB)' }, 413);
  }

  const found = await findByIdInR2(env.ARCHIVE, id);
  if (!found) {
    return json({ error: 'Propuesta no encontrada' }, 404);
  }

  // Conservamos el customMetadata original y solo refrescamos updatedAt.
  const head = await env.ARCHIVE.head(found.key);
  const customMetadata = Object.assign({}, head ? head.customMetadata || {} : {}, {
    updatedAt: new Date().toISOString(),
  });
  for (const k of Object.keys(customMetadata)) {
    customMetadata[k] = String(customMetadata[k]).slice(0, 500);
  }

  await env.ARCHIVE.put(found.key, html, {
    httpMetadata: {
      contentType: 'text/html; charset=utf-8',
      contentLanguage: 'es',
    },
    customMetadata,
  });

  return json({ ok: true, id, key: found.key });
}

async function findByIdInR2(bucket, id) {
  let cursor;
  for (let i = 0; i < 20; i++) {
    const page = await bucket.list({ prefix: 'proposals/', limit: 1000, cursor });
    for (const obj of page.objects) {
      if (obj.key.endsWith(`/${id}.html`)) return obj;
    }
    if (!page.truncated) break;
    cursor = page.cursor;
  }
  return null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
