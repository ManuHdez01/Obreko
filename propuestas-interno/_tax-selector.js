// Selector IVA / IGIC para las propuestas aplicables.
// Se incluye con <script src="_tax-selector.js"></script>.
// Las propuestas de inversores (inversion-alquiler, mantenimiento-pronexo) NO lo cargan: siempre IVA.

(function () {
  'use strict';

  // Slugs donde aplica el selector. Si la URL no coincide, no hace nada.
  const ELIGIBLE = ['reformas', 'adecuacion', 'obras-pequenas', 'mantenimiento', 'manitas', 'hogar-conectado'];

  const RATES = {
    iva: { pct: 21, rate: 0.21, label: 'IVA 21%' },
    igic: { pct: 7, rate: 0.07, label: 'IGIC 7%' },
  };

  const LS_KEY = 'obreko-tax-type'; // iva | igic — se persiste en navegador

  function getSlug() {
    // Vale tanto para la propuesta publicada (/propuestas/reformas) como para el
    // editor interno (/propuestas-interno/reformas.html), que es donde se
    // prepara y se exporta el PDF: si aquí no se activaba, el documento salía
    // con IVA 21% aunque la obra fuera canaria.
    const m = location.pathname.match(/\/propuestas(?:-interno)?\/([^/]+?)(?:\.html)?\/?$/);
    return m ? m[1] : '';
  }

  if (!ELIGIBLE.includes(getSlug())) return;

  let current = 'iva';
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved === 'iva' || saved === 'igic') current = saved;
  } catch (e) {}

  window.getTaxRate = () => RATES[current].rate;
  window.getTaxLabel = () => RATES[current].label;
  window.getTaxPct = () => RATES[current].pct;

  function setTax(newValue) {
    if (!RATES[newValue]) return;
    current = newValue;
    try { localStorage.setItem(LS_KEY, current); } catch (e) {}
    // Forzar recálculo del presupuesto si hay función estándar
    if (typeof window.calcBudget === 'function') {
      try { window.calcBudget(); } catch (e) {}
    }
    // Sincronizar estado en todos los selects que tengamos (por si hay duplicados)
    document.querySelectorAll('select.tax-type-select').forEach((s) => {
      if (s.value !== current) s.value = current;
    });
    // Si existía ivaRate como input numérico en el HTML original, mantenerlo sincronizado por compat
    const legacy = document.getElementById('ivaRate');
    if (legacy && legacy !== document.querySelector('select.tax-type-select')) {
      legacy.value = String(RATES[current].pct);
    }
    // Actualizar etiqueta delante de cada select inline de cabecera (IVA/IGIC aplicable:)
    document.querySelectorAll('select[data-header-select]').forEach((s) => {
      const sibling = s.previousElementSibling;
      if (sibling && /IVA|IGIC/i.test(sibling.textContent || '')) {
        sibling.textContent = (current === 'iva' ? 'IVA' : 'IGIC') + ' aplicable: ';
      }
    });
    // Actualizar textos descriptivos ("IVA aplicable: 21%" → "IGIC aplicable: 7%")
    updateDescriptorTexts();
  }

  // Actualiza cualquier texto tipo "IVA aplicable: N%", "sin IVA. IVA aplicable: N%",
  // "Precios sin IVA", "(sin IVA)" etc. para que refleje el impuesto seleccionado.
  function updateDescriptorTexts() {
    const otherLabel = current === 'iva' ? 'IVA' : 'IGIC';
    const otherPct = RATES[current].pct;

    // Buscamos text nodes en zonas probables (cabeceras de presupuesto, notas)
    const containers = document.querySelectorAll(
      '.p7-header-sub, .budget-header-sub, .budget-note, .budget-footnote, ' +
      '.conditions-note, .plans-note, [data-tax-descriptor]'
    );
    containers.forEach((c) => {
      const walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT, null);
      let n;
      const edits = [];
      while ((n = walker.nextNode())) {
        let t = n.nodeValue;
        let out = t;
        // Patrón: "IVA aplicable: 21%" / "IGIC aplicable: 7%"
        out = out.replace(/\b(IVA|IGIC)\s+aplicable\s*:\s*\d+(?:[,\.]\d+)?\s*%/gi,
          otherLabel + ' aplicable: ' + otherPct + '%');
        // Patrón: "sin IVA" / "sin IGIC" — mantenemos pero sincronizamos
        out = out.replace(/\bsin\s+(IVA|IGIC)\b/gi, 'sin ' + otherLabel);
        // Patrón: "(sin IVA)" / "(sin IGIC)"
        out = out.replace(/\(\s*sin\s+(IVA|IGIC)\s*\)/gi, '(sin ' + otherLabel + ')');
        // Patrón: "IVA incluido" / "IGIC incluido" (pie del presupuesto detallado)
        out = out.replace(/\b(IVA|IGIC)\s+incluido\b/gi, otherLabel + ' incluido');
        if (out !== t) edits.push({ node: n, value: out });
      }
      edits.forEach((e) => { e.node.nodeValue = e.value; });
    });

    // Caso especial — textos en filas de subtotal tipo "SUBTOTAL (sin IVA)"
    // Buscamos cualquier td/span que contenga ese patrón (nivel global)
    document.querySelectorAll('td, span, div, p').forEach((el) => {
      // Solo elementos que tienen texto directo simple, evitar el propio select
      if (el.children.length > 0) return;
      const t = el.textContent;
      if (!t) return;
      if (/\(\s*sin\s+(IVA|IGIC)\s*\)/i.test(t)) {
        el.textContent = t.replace(/\(\s*sin\s+(IVA|IGIC)\s*\)/gi, '(sin ' + otherLabel + ')');
      }
    });
  }

  function buildSelectHtml() {
    return '<select class="tax-type-select" aria-label="Tipo de impuesto">' +
      '<option value="iva"' + (current === 'iva' ? ' selected' : '') + '>IVA 21%</option>' +
      '<option value="igic"' + (current === 'igic' ? ' selected' : '') + '>IGIC 7%</option>' +
      '</select>';
  }

  function injectStyles() {
    if (document.getElementById('taxSelectorStyles')) return;
    const s = document.createElement('style');
    s.id = 'taxSelectorStyles';
    s.textContent = `
      .tax-type-select{
        background:transparent;border:none;border-bottom:1px dotted rgba(26,34,54,.3);
        font:inherit;color:inherit;cursor:pointer;padding:0 16px 1px 4px;outline:none;
        appearance:none;-webkit-appearance:none;
        background-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="%235C7CD9" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
        background-repeat:no-repeat;background-position:right 2px center;background-size:8px;
      }
      .tax-type-select:hover{border-bottom-color:var(--blue,#5C7CD9);}
      .tax-type-select:focus{border-bottom-color:var(--blue,#5C7CD9);}
      @media print{
        .tax-type-select{
          appearance:none;-webkit-appearance:none;border:none;padding:0;background:none;
          color:inherit;-webkit-print-color-adjust:exact;
        }
      }
    `;
    document.head.appendChild(s);
  }

  function replaceRowContent() {
    injectStyles();

    const row = document.getElementById('rowIva');
    if (!row) return;

    // Caso A — existe #ivaRate como <input> (mantenimiento.html, quizás otros):
    //   lo convertimos en <select class="tax-type-select"> preservando el id.
    const legacy = row.querySelector('#ivaRate');
    if (legacy && legacy.tagName === 'INPUT') {
      const wrapper = document.createElement('span');
      wrapper.innerHTML = buildSelectHtml();
      const sel = wrapper.querySelector('select');
      // Preservamos también el id por si algún código antiguo lee legacy.value
      sel.id = 'ivaRate';
      // Interceptamos .value para que el cálculo antiguo siga funcionando: al leerlo, devolvemos el pct
      Object.defineProperty(sel, 'ivaPct', { get: () => RATES[current].pct });
      sel.addEventListener('change', (e) => setTax(e.target.value));
      legacy.replaceWith(sel);
      return;
    }

    // Caso B — la fila tiene texto estático "IVA 21%" que hay que reemplazar
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT, null);
    let node;
    const nodesToReplace = [];
    while ((node = walker.nextNode())) {
      if (/IVA\s*21\s*%/i.test(node.nodeValue)) {
        nodesToReplace.push(node);
      }
    }
    nodesToReplace.forEach((n) => {
      const span = document.createElement('span');
      span.innerHTML = n.nodeValue.replace(/IVA\s*21\s*%/i, buildSelectHtml());
      const select = span.querySelector('select');
      if (select) select.addEventListener('change', (e) => setTax(e.target.value));
      n.parentNode.replaceChild(span, n);
    });
  }

  // Inyecta un mini selector inline dentro de los subtítulos de presupuesto
  // (ej. ".p7-header-sub") reemplazando "IVA aplicable: 21%" por un <select> interactivo.
  // El resto del texto permanece editable si el elemento tiene contenteditable="true".
  function injectHeaderSelectors() {
    const containers = document.querySelectorAll(
      '.p7-header-sub, .budget-header-sub, [data-tax-descriptor]'
    );
    containers.forEach((c) => {
      if (c.querySelector('select.tax-type-select')) return; // ya tiene uno
      const walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT, null);
      const matches = [];
      let n;
      while ((n = walker.nextNode())) {
        if (/\b(IVA|IGIC)\s+aplicable\s*:\s*\d+(?:[,.]\d+)?\s*%/i.test(n.nodeValue)) {
          matches.push(n);
        }
      }
      matches.forEach((textNode) => {
        const re = /\b(?:IVA|IGIC)\s+aplicable\s*:\s*\d+(?:[,.]\d+)?\s*%/i;
        const parts = textNode.nodeValue.split(re);
        const match = textNode.nodeValue.match(re);
        if (!match) return;
        const frag = document.createDocumentFragment();
        if (parts[0]) frag.appendChild(document.createTextNode(parts[0]));
        // Wrapper no editable que contiene el selector
        const wrap = document.createElement('span');
        wrap.contentEditable = 'false';
        wrap.style.cssText = 'display:inline-flex;align-items:baseline;gap:3px;';
        wrap.innerHTML = '<span style="color:inherit">' +
          (current === 'iva' ? 'IVA' : 'IGIC') +
          ' aplicable: </span>' + buildSelectHtml().replace('<select ', '<select data-header-select="1" ');
        const sel = wrap.querySelector('select');
        sel.addEventListener('change', (e) => setTax(e.target.value));
        // Mostrar solo el % en este select para que sea más corto
        sel.innerHTML = '<option value="iva"' + (current === 'iva' ? ' selected' : '') + '>21%</option>' +
                        '<option value="igic"' + (current === 'igic' ? ' selected' : '') + '>7%</option>';
        frag.appendChild(wrap);
        if (parts[1]) frag.appendChild(document.createTextNode(parts[1]));
        textNode.parentNode.replaceChild(frag, textNode);
      });
    });

    // Después de inyectar, el label "IVA" o "IGIC" delante del select también
    // se sincroniza con el actual (porque puede haber cambiado desde el estado por defecto)
    document.querySelectorAll('select[data-header-select]').forEach((s) => {
      const sibling = s.previousElementSibling;
      if (sibling && /IVA|IGIC/i.test(sibling.textContent || '')) {
        sibling.textContent = (current === 'iva' ? 'IVA' : 'IGIC') + ' aplicable: ';
      }
    });
  }

  function init() {
    replaceRowContent();
    injectHeaderSelectors();
    updateDescriptorTexts();
    // Dispara un recálculo inicial si calcBudget existe (por si la propuesta ya tenía valores)
    if (typeof window.calcBudget === 'function') {
      setTimeout(() => { try { window.calcBudget(); } catch (e) {} }, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
