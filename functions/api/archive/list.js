// GET /api/archive/list — lista propuestas archivadas (requiere sesión)
// Devuelve metadata + URL interna para abrir cada propuesta.
import { verifySession } from './_auth.js';

export async function onRequestGet({ request, env }) {
  if (!(await verifySession(request, env))) {
    return json({ error: 'No autenticado' }, 401);
  }
  if (!env.ARCHIVE) {
    return json({ error: 'Bucket R2 no configurado' }, 503);
  }

  const items = [];
  let cursor;
  // Paginamos hasta agotar (bounded por retention 1 año + volumen esperado < 1000)
  for (let i = 0; i < 20; i++) {
    const page = await env.ARCHIVE.list({
      prefix: 'proposals/',
      limit: 1000,
      cursor,
      include: ['customMetadata', 'httpMetadata'],
    });
    for (const obj of page.objects) {
      const m = obj.customMetadata || {};
      const id = obj.key.replace(/^proposals\/\d+\/\d+\//, '').replace(/\.html$/, '');
      items.push({
        id,
        key: obj.key,
        url: `/archivo/${id}`,
        size: obj.size,
        uploaded: obj.uploaded,
        ref: m.ref || '',
        slug: m.slug || '',
        type: m.type || '',
        client: m.client || '',
        amount: Number(m.amount) || 0,
        email: m.email || '',
        phone: m.phone || '',
        savedAt: m.savedAt || obj.uploaded,
        hubspotDealId: m.hubspotDealId || '',
      });
    }
    if (!page.truncated) break;
    cursor = page.cursor;
  }

  // Orden desc por fecha de guardado
  items.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));

  return json({ count: items.length, items });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
