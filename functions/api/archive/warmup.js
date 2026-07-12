// GET /api/archive/warmup?return=<url>
//
// El navegador solo llega aquí después de que Cloudflare Access complete su
// autenticación silenciosa para esta sub-aplicación (si Access no dejara
// pasar la petición, esta función ni se ejecutaría). Se usa como "rebote"
// de navegación real — Access bloquea que su propia pantalla de login se
// cargue en un iframe, así que hace falta una navegación de página completa
// para fijar la cookie de esta app antes de volver a donde estaba el
// usuario.
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  let ret = url.searchParams.get('return') || '/archivo/';
  // Solo rutas relativas del propio sitio (evita open redirect).
  if (!ret.startsWith('/') || ret.startsWith('//')) ret = '/archivo/';
  return new Response(null, { status: 302, headers: { Location: ret, 'Cache-Control': 'no-store' } });
}
