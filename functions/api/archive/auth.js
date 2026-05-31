// POST /api/archive/auth — valida PIN y devuelve cookie de sesión
// DELETE /api/archive/auth — cierra sesión
import { createSessionCookie, clearSessionCookie, verifySession } from './_auth.js';

export async function onRequestPost({ request, env }) {
  if (!env.ARCHIVE_PIN || !env.ARCHIVE_SESSION_SECRET) {
    return json({ error: 'Backend no configurado' }, 503);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  const pin = String(body.pin || '').trim();
  if (!pin) return json({ error: 'Falta PIN' }, 400);
  if (pin !== env.ARCHIVE_PIN) {
    // Pausa corta para ralentizar fuerza bruta
    await new Promise((r) => setTimeout(r, 400));
    return json({ error: 'PIN incorrecto' }, 401);
  }
  const cookie = await createSessionCookie(env);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': cookie,
      'Cache-Control': 'no-store',
    },
  });
}

export async function onRequestDelete() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': clearSessionCookie(),
      'Cache-Control': 'no-store',
    },
  });
}

export async function onRequestGet({ request, env }) {
  const ok = await verifySession(request, env);
  return new Response(JSON.stringify({ authenticated: ok }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
