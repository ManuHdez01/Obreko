// GET /archivo/[id] — sirve el HTML de una propuesta archivada (requiere sesión).
// Si la URL incluye ?edit=1, inyecta una barra flotante con "Guardar cambios" + "Salir sin guardar"
// que postea el HTML modificado a /api/archive/update.

import { verifySession } from '../api/archive/_auth.js';

export async function onRequestGet({ request, env, params }) {
  if (!(await verifySession(request, env))) {
    const path = '/archivo/' + params.id + (new URL(request.url).search || '');
    const redirect = `/archivo/?next=${encodeURIComponent(path)}`;
    return new Response(null, {
      status: 302,
      headers: { Location: redirect, 'Cache-Control': 'no-store' },
    });
  }
  if (!env.ARCHIVE) {
    return new Response('Bucket R2 no configurado', { status: 503 });
  }

  const id = String(params.id || '');
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
    return new Response('ID inválido', { status: 400 });
  }

  const found = await findByIdInR2(env.ARCHIVE, id);
  if (!found) {
    return new Response('Propuesta no encontrada (puede haber caducado el archivo de 1 año)', { status: 404 });
  }

  const obj = await env.ARCHIVE.get(found.key);
  if (!obj) {
    return new Response('Propuesta no encontrada', { status: 404 });
  }

  const url = new URL(request.url);
  const editMode = url.searchParams.get('edit') === '1';

  let html;
  if (editMode) {
    const original = await obj.text();
    html = injectEditBar(original, id);
  } else {
    html = obj.body;
  }

  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
  });
  return new Response(html, { status: 200, headers });
}

function injectEditBar(html, id) {
  const safeId = String(id).replace(/[^A-Za-z0-9_-]/g, '');
  const bar = `
<div id="archiveEditBar" style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#1A2236;color:#fff;padding:10px 18px;display:flex;align-items:center;gap:14px;font-family:'DM Sans',Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.25);">
  <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#FED544;font-weight:700;">EDICIÓN ARCHIVO</div>
  <div id="archiveEditMsg" style="flex:1;font-size:12px;color:rgba(255,255,255,.65);">Cualquier cambio sobreescribe el snapshot guardado.</div>
  <button id="archiveSaveBtn" style="background:#FED544;color:#1A2236;border:none;padding:8px 16px;font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;border-radius:4px;">Guardar cambios</button>
  <a href="/archivo/" style="background:rgba(255,255,255,.08);color:#fff;text-decoration:none;padding:8px 14px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;border-radius:4px;">Salir</a>
</div>
<style>body{padding-top:46px !important;}@media print{#archiveEditBar{display:none !important;}body{padding-top:0 !important;}}</style>
<script>
(function(){
  var btn=document.getElementById('archiveSaveBtn');
  var msg=document.getElementById('archiveEditMsg');
  if(!btn) return;
  btn.addEventListener('click', async function(){
    btn.disabled=true;
    var prev=btn.textContent;
    btn.textContent='Guardando…';
    msg.style.color='rgba(255,255,255,.65)';
    msg.textContent='Subiendo cambios…';
    try{
      // Clonamos el documento sin la barra, scripts inyectados ni estilos de la barra
      var clone=document.documentElement.cloneNode(true);
      var bar=clone.querySelector('#archiveEditBar'); if(bar) bar.remove();
      // Quitar también el <style> y <script> que añadimos para la edición
      clone.querySelectorAll('script').forEach(function(s){ if((s.textContent||'').indexOf('archiveSaveBtn')>=0) s.remove(); });
      clone.querySelectorAll('style').forEach(function(s){ if((s.textContent||'').indexOf('archiveEditBar')>=0) s.remove(); });
      var html='<!DOCTYPE html>\\n'+clone.outerHTML;
      var r=await fetch('/api/archive/update',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({id:${JSON.stringify(safeId)}, html:html})
      });
      if(!r.ok){ throw new Error('HTTP '+r.status); }
      msg.style.color='#9be58a';
      msg.textContent='Cambios guardados ✓';
    }catch(e){
      msg.style.color='#ff8a80';
      msg.textContent='Error al guardar: '+(e && e.message ? e.message : e);
    }finally{
      btn.disabled=false;
      btn.textContent=prev;
    }
  });
})();
</script>`;
  if (html.indexOf('</body>') !== -1) {
    return html.replace('</body>', bar + '\n</body>');
  }
  return html + bar;
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
