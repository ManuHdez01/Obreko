// GET /api/budget-tool/imagen?key=budget-tool/<projectId>/<archivo>
//
// Sirve las fotos y planos que se subieron al análisis del proyecto, que
// analyze.js guarda en R2. Los necesita la propuesta para volcar la
// documentación gráfica sin que haya que volver a adjuntar los archivos a
// mano en la plantilla.
//
// Solo se sirven objetos bajo el prefijo budget-tool/: la clave llega por la
// URL, así que sin ese filtro se podría pedir cualquier cosa del bucket.

import { verifySession } from './_auth.js';

const PREFIJO = 'budget-tool/';

export async function onRequestGet({ request, env }) {
  if (!(await verifySession(request, env))) return json({ error: 'No autenticado' }, 401);
  if (!env.ARCHIVE) return json({ error: 'R2 ARCHIVE no configurado' }, 503);

  const key = new URL(request.url).searchParams.get('key') || '';
  if (!key.startsWith(PREFIJO) || key.includes('..')) {
    return json({ error: 'Clave no válida' }, 400);
  }

  const obj = await env.ARCHIVE.get(key);
  if (!obj) return json({ error: 'Archivo no encontrado' }, 404);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  // Privado: es documentación de un cliente, no se cachea en intermediarios.
  headers.set('Cache-Control', 'private, max-age=3600');
  return new Response(obj.body, { headers });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
