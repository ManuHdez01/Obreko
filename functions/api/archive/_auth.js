// Helpers de autenticación para el archivo de propuestas.
// Usa cookie firmada con HMAC-SHA256 y caduca en 12h.

const COOKIE_NAME = 'obreko_archive_session';
const SESSION_HOURS = 12;

export async function createSessionCookie(env) {
  const payload = { iat: Math.floor(Date.now() / 1000) };
  const body = btoa(JSON.stringify(payload));
  const sig = await hmacSha256Hex(env.ARCHIVE_SESSION_SECRET, body);
  const value = `${body}.${sig}`;
  const maxAge = SESSION_HOURS * 3600;
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export async function verifySession(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;
  const value = match[1];
  const [body, sig] = value.split('.');
  if (!body || !sig) return false;
  const expected = await hmacSha256Hex(env.ARCHIVE_SESSION_SECRET, body);
  if (!timingSafeEq(expected, sig)) return false;
  try {
    const payload = JSON.parse(atob(body));
    const now = Math.floor(Date.now() / 1000);
    if (now - payload.iat > SESSION_HOURS * 3600) return false;
    return true;
  } catch {
    return false;
  }
}

async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEq(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
