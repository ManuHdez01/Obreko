// Botón "Eliminar página completa" en cada .page (visible en pantalla, oculto en impresión).
// Se omite en la primera página (portada) y en las marcadas como `data-no-delete="1"`.

(function () {
  'use strict';

  var STYLES = '\
.page-delete-btn{position:absolute;top:8px;right:8px;z-index:50;background:rgba(198,40,40,.92);color:#fff;border:none;border-radius:4px;padding:6px 10px;font-family:\'DM Sans\',Arial,sans-serif;font-size:9px;text-transform:uppercase;letter-spacing:.1em;font-weight:600;cursor:pointer;opacity:0;transition:opacity .18s,background .18s;display:flex;align-items:center;gap:6px;}\
.page-delete-btn::before{content:\'×\';font-size:13pt;line-height:1;font-weight:400;letter-spacing:0;}\
.page:hover > .page-delete-btn{opacity:.85;}\
.page-delete-btn:hover{opacity:1 !important;background:#a31919;}\
@media print{.page-delete-btn{display:none !important;}}\
';

  function injectStyles() {
    if (document.getElementById('page-delete-styles')) return;
    var s = document.createElement('style');
    s.id = 'page-delete-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  function attach(page) {
    if (!page || page.dataset.deleteBtnAttached) return;
    if (page.dataset.noDelete === '1') return;
    if (page.classList.contains('blank-page')) return;
    page.dataset.deleteBtnAttached = '1';
    var cs = window.getComputedStyle(page);
    if (cs.position === 'static') page.style.position = 'relative';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'page-delete-btn';
    btn.contentEditable = 'false';
    btn.title = 'Eliminar página completa';
    btn.textContent = 'Eliminar página';
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var ok = window.confirm('¿Eliminar esta página completa? Esta acción no se puede deshacer en esta sesión.');
      if (!ok) return;
      page.remove();
      if (typeof window.scalePages === 'function') window.scalePages();
      window.dispatchEvent(new Event('page-deleted'));
    });
    page.appendChild(btn);
  }

  function attachAll() {
    var pages = document.querySelectorAll('.page');
    // Saltar primera página (portada).
    pages.forEach(function (p, idx) {
      if (idx === 0) return;
      attach(p);
    });
  }

  function init() {
    injectStyles();
    attachAll();
    var mo = new MutationObserver(function () { attachAll(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
