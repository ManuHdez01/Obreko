// Script compartido: inyecta el botón "📄 Formalizar contrato" en la toolbar
// de las propuestas propias de obreko (no en las de gestión para terceros
// tipo Pronexo inversores, que son un tipo de relación contractual distinta).
// Extrae los datos de la propuesta abierta y abre _contrato.html en una
// pestaña nueva, que los recoge de localStorage y rellena el documento.

(function () {
  'use strict';

  // Mismo alcance que _tax-selector.js: las propuestas propias de obreko.
  // inversion-alquiler, mantenimiento-pronexo y mejoras-pronexo quedan fuera
  // porque ahí "Pronexo" es la gestora de un inmueble de un tercero, no la
  // razón social de obreko — mezclar ambos contextos en el mismo contrato
  // sería incorrecto.
  var ELIGIBLE = ['reformas', 'adecuacion', 'obras-pequenas', 'mantenimiento', 'manitas', 'hogar-conectado'];

  var TITLE_MAP = {
    'reformas':        'Reforma integral residencial',
    'adecuacion':      'Adecuación de espacios',
    'obras-pequenas':  'Obras pequeñas y mejoras',
    'mantenimiento':   'Mantenimiento preventivo y correctivo',
    'manitas':         'Servicio manitas profesional',
    'hogar-conectado': 'Hogar conectado e inteligente',
  };

  function getSlug() {
    var m = location.pathname.match(/\/propuestas(?:-interno)?\/([^/]+?)(?:\.html)?\/?$/);
    return m ? m[1] : '';
  }

  var slug = getSlug();
  if (ELIGIBLE.indexOf(slug) === -1) return;

  function txt(sel) {
    var el = document.querySelector(sel);
    return el ? (el.textContent || '').trim() : '';
  }

  function extractData() {
    var clientName = txt('.cover-client-name') || txt('.p1-client-name');
    var clientAddress = txt('.cover-client-addr') || txt('.p1-client-addr');
    var ref = txt('.cover-meta-ref') || txt('.p1-meta [contenteditable]');

    var amountText = '';
    ['#grand', '.grand', '#budget-grand', '.budget-grand'].some(function (sel) {
      var t = txt(sel); if (t) { amountText = t; return true; } return false;
    });

    var baseText = '';
    ['#totalContrata', '#subtotal', '.subtotal'].some(function (sel) {
      var t = txt(sel); if (t) { baseText = t; return true; } return false;
    });

    var capitulos = Array.prototype.map.call(document.querySelectorAll('.cat-row'), function (el) {
      return (el.textContent || '').trim();
    }).filter(function (v, i, arr) { return v && arr.indexOf(v) === i; });

    var taxLabel = (typeof window.getTaxLabel === 'function') ? window.getTaxLabel() : 'IVA 21%';
    var region = /IGIC/i.test(taxLabel) ? 'Canarias' : 'Madrid';

    return {
      v: 1, createdAt: new Date().toISOString(),
      slug: slug, title: TITLE_MAP[slug] || slug,
      ref: ref, clientName: clientName, clientAddress: clientAddress,
      amountText: amountText, baseText: baseText,
      capitulos: capitulos, taxLabel: taxLabel, region: region,
    };
  }

  function onClick() {
    var data = extractData();
    if (!data.clientName || !data.amountText) {
      if (!confirm('El presupuesto o el nombre del cliente no parecen estar rellenos todavía. ¿Abrir el contrato igualmente?')) return;
    }
    try { localStorage.setItem('obreko_contrato_data', JSON.stringify(data)); } catch (e) {}
    window.open('_contrato.html', '_blank', 'noopener');
  }

  function addButton() {
    if (document.querySelector('.contrato-btn')) return;

    var btn = document.createElement('button');
    btn.className = 'contrato-btn';
    btn.type = 'button';
    btn.innerHTML = '📄 Formalizar contrato';
    btn.addEventListener('click', onClick);

    // Caso 1: propuestas con toolbar completa
    var toolbar = document.querySelector('.toolbar');
    if (toolbar) {
      btn.className = 'toolbar-btn contrato-btn';
      btn.style.cssText = 'background:#1A2236;color:#fff;border:none;padding:0 14px;height:34px;border-radius:6px;font-family:inherit;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;margin-right:8px';
      btn.addEventListener('mouseenter', function () { btn.style.background = '#2a3550'; });
      btn.addEventListener('mouseleave', function () { btn.style.background = '#1A2236'; });
      var printBtn = toolbar.querySelector('.toolbar-btn.primary');
      if (printBtn) toolbar.insertBefore(btn, printBtn); else toolbar.appendChild(btn);
      return;
    }

    // Caso 2: propuestas con solo un botón flotante "Imprimir / PDF"
    var printFloat = document.querySelector('.print-btn, #print-btn');
    if (printFloat) {
      var crmBtn = document.querySelector('.crm-save-btn');
      var rectRef = (crmBtn || printFloat).getBoundingClientRect();
      var refStyle = window.getComputedStyle(crmBtn || printFloat);
      btn.style.cssText = 'position:fixed;top:' + refStyle.top + ';right:calc(' + refStyle.right + ' + ' + Math.ceil(rectRef.width) + 'px + 10px);z-index:200;background:#1A2236;color:#fff;border:none;padding:' + refStyle.padding + ';font-family:inherit;font-size:10px;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25);transition:background .2s';
      btn.addEventListener('mouseenter', function () { btn.style.background = '#2a3550'; });
      btn.addEventListener('mouseleave', function () { btn.style.background = '#1A2236'; });
      document.body.appendChild(btn);

      var style = document.createElement('style');
      style.textContent = '@media print{.contrato-btn{display:none !important;}}';
      document.head.appendChild(style);
      return;
    }

    // Caso 3 (fallback)
    btn.style.cssText = 'position:fixed;top:14px;right:340px;z-index:200;background:#1A2236;color:#fff;border:none;padding:8px 18px;font-family:Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25)';
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButton);
  else addButton();
})();
