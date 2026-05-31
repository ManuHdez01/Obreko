// Cloudflare Pages Function — POST /api/tickets
// Crea una issue en el repo configurado usando la GitHub REST API.
//
// Variables de entorno requeridas (se configuran con wrangler o en el dashboard):
//   GITHUB_TOKEN → Fine-grained Personal Access Token con permiso "Issues: Read & write"
//                  sobre el repo target
//   GITHUB_REPO  → "owner/repo", ej. "ManuHdez01/obreko-tickets"
//
// Opcional:
//   BOT_ALLOWED_ORIGIN → restringe a ese Origin (recomendado en producción)

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    return json({ error: 'Backend no configurado. Faltan GITHUB_TOKEN y/o GITHUB_REPO.' }, 503);
  }

  const origin = request.headers.get('Origin') || '';
  const allowedList = (env.BOT_ALLOWED_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowedList.length && !allowedList.includes(origin)) {
    return json({ error: 'Origen no autorizado.', origin }, 403);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }

  const title = String(payload.title || '').trim();
  const body = String(payload.body || '').trim();
  const labels = Array.isArray(payload.labels)
    ? payload.labels.map((l) => String(l).trim()).filter(Boolean).slice(0, 8)
    : [];

  if (!title || title.length > 250) return json({ error: 'Título inválido.' }, 400);
  if (!body || body.length > 20000) return json({ error: 'Cuerpo inválido.' }, 400);

  const ghRes = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'obrekobot/1.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body, labels }),
  });

  const ghJson = await ghRes.json().catch(() => ({}));

  if (!ghRes.ok) {
    return json({
      error: 'GitHub rechazó la creación.',
      status: ghRes.status,
      details: ghJson.message || null,
    }, 502);
  }

  return json({
    number: ghJson.number,
    url: ghJson.html_url,
    title: ghJson.title,
  });
}

export async function onRequestOptions({ request, env }) {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.BOT_ALLOWED_ORIGIN || origin;
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowed,
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
