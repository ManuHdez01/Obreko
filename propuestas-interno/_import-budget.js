// Script compartido: importa a la tabla #budgetBody el presupuesto preparado
// por la herramienta interna (herramienta-presupuestos/), que lo deja en
// localStorage['obreko_budget_import'] con precios de VENTA (margen aplicado).
// Muestra un banner de confirmación antes de tocar nada; el usuario decide.
//
// Formato del payload:
//   { v:1, createdAt, ref, clientName,
//     rows: [{ concept, desc, mat, labor }], total }

(function () {
  'use strict';

  var KEY = 'obreko_budget_import';
  var MAX_AGE_MS = 60 * 60 * 1000; // 1h: si es más viejo, se descarta en silencio

  function readPayload() {
    var raw;
    try { raw = localStorage.getItem(KEY); } catch (e) { return null; }
    if (!raw) return null;
    var p;
    try { p = JSON.parse(raw); } catch (e) { localStorage.removeItem(KEY); return null; }
    if (!p || p.v !== 1 || !Array.isArray(p.rows) || !p.rows.length) { localStorage.removeItem(KEY); return null; }
    if (p.createdAt && (Date.now() - new Date(p.createdAt).getTime()) > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return p;
  }

  function fmtMoney(n) {
    return (Number(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function setCell(cell, value) {
    if (!cell) return;
    var input = cell.tagName === 'INPUT' ? cell : cell.querySelector('input');
    if (input) input.value = value;
    else cell.textContent = value;
  }

  function dataRows(tbody) {
    return Array.prototype.filter.call(tbody.querySelectorAll('tr'), function (tr) {
      if (tr.classList.contains('cat-row')) return false;
      return tr.querySelector('[data-type="mat"]') || tr.querySelector('[data-type="labor"]');
    });
  }

  function ensureRows(tbody, needed) {
    var rows = dataRows(tbody);
    var template = rows[rows.length - 1];
    while (rows.length < needed && template) {
      var clone = template.cloneNode(true);
      tbody.appendChild(clone);
      rows = dataRows(tbody);
    }
    return rows;
  }

  function conceptCell(tr) {
    return tr.querySelector('td.concept') ||
      tr.querySelector('td[contenteditable]') ||
      (function () {
        var inp = tr.querySelector('td input[type="text"]');
        return inp || null;
      })();
  }

  function applyImport(payload) {
    var tbody = document.getElementById('budgetBody');
    if (!tbody) { alert('Esta plantilla no tiene tabla de presupuesto compatible.'); return false; }

    var rows = ensureRows(tbody, payload.rows.length);
    rows.forEach(function (tr, i) {
      var data = payload.rows[i];
      var mat = tr.querySelector('[data-type="mat"]');
      var labor = tr.querySelector('[data-type="labor"]');
      var qty = tr.querySelector('[data-type="qty"]');
      if (data) {
        setCell(conceptCell(tr), data.concept || '');
        var desc = tr.querySelector('td.desc');
        if (desc) setCell(desc, data.desc || '');
        setCell(mat, data.mat > 0 ? fmtMoney(data.mat) : '—');
        setCell(labor, data.labor > 0 ? fmtMoney(data.labor) : '—');
        if (qty) setCell(qty, '1');
      } else {
        // Fila sobrante de la plantilla: limpiar importes para no ensuciar el total
        setCell(mat, '—');
        setCell(labor, '—');
      }
    });

    // Portada: cliente y referencia si la plantilla los tiene (los nombres de
    // clase varían entre plantillas)
    var clientEl = document.querySelector('.cover-client-name, .p1-client-name');
    if (clientEl && payload.clientName) clientEl.textContent = payload.clientName;
    var refEl = document.querySelector('.cover-meta-ref, .cover-ref');
    if (refEl && payload.ref) refEl.textContent = payload.ref;

    // Portada: referencia, fecha y dirección del inmueble
    var meta = document.querySelectorAll('.p1-meta [contenteditable]');
    if (meta.length && payload.ref) meta[0].textContent = payload.ref;
    if (meta.length > 1 && payload.fecha) meta[1].textContent = payload.fecha;
    var addrEl = document.querySelector('.p1-client-addr');
    if (addrEl && payload.address) addrEl.textContent = payload.address;

    rellenarFichaTecnica(payload);

    // Contexto de la obra para la varita de redacción: sobrevive al borrado
    // del payload de importación.
    try {
      localStorage.setItem('obreko_proposal_ctx', JSON.stringify({
        tipo: payload.tipo || '', m2: payload.m2 || 0, address: payload.address || '',
        region: payload.region || 'tenerife', clientName: payload.clientName || '',
        capitulos: (payload.rows || []).map(function (r) { return r.desc; })
          .filter(function (d, idx, arr) { return d && arr.indexOf(d) === idx; }).slice(0, 20),
      }));
    } catch (e) {}

    aplicarTextos(payload.textos);

    if (typeof window.calcBudget === 'function') window.calcBudget();
    // Los bloques recién creados también tienen que llevar su varita.
    if (typeof window.montarVaritasIA === 'function') window.montarVaritasIA();
    return true;
  }

  // Ficha técnica: los campos se localizan por su etiqueta, que es lo único
  // estable entre plantillas.
  function rellenarFichaTecnica(payload) {
    var campos = document.querySelectorAll('.p4-field');
    if (!campos.length) return;
    var est = payload.estancias || {};
    var estancias = (Number(est.cocinas) || 0) + (Number(est.banos) || 0) + (Number(est.dormitorios) || 0);
    var valores = {
      'tipo de inmueble': payload.tipo || '',
      'dirección completa': payload.address || '',
      'superficie total': payload.m2 ? String(payload.m2).replace('.', ',') + ' m²' : '',
      'nº de estancias': estancias ? String(estancias) : '',
    };
    Array.prototype.forEach.call(campos, function (campo) {
      var etiqueta = campo.querySelector('.p4-field-label');
      var valor = campo.querySelector('.p4-field-val');
      if (!etiqueta || !valor) return;
      var clave = etiqueta.textContent.trim().toLowerCase();
      if (valores[clave]) valor.textContent = valores[clave];
    });
  }

  // Textos adaptados por la IA a esta obra y esta zona. Cada hueco se rellena
  // solo si la plantilla lo tiene; las plantillas viejas siguen funcionando.
  function aplicarTextos(textos) {
    if (!textos) return;

    var intro = document.querySelector('[data-ai-slot="intro"]');
    if (intro && textos.intro) intro.textContent = textos.intro;

    var objetivo = document.querySelector('[data-ai-slot="objetivo"]');
    if (objetivo && textos.objetivo) objetivo.textContent = textos.objetivo;

    // El enfoque va justo debajo del objetivo, como segundo párrafo.
    if (objetivo && textos.enfoque) {
      var previo = objetivo.parentNode.querySelector('[data-ai-enfoque]');
      if (previo) previo.remove();
      var extra = document.createElement('div');
      extra.setAttribute('data-ai-enfoque', '1');
      extra.className = objetivo.className;
      extra.contentEditable = 'true';
      extra.style.marginTop = '3mm';
      extra.setAttribute('data-ai-wand', 'enfoque');
      extra.textContent = textos.enfoque;
      // Si el objetivo ya tiene su varita al lado, el párrafo va detrás de ella:
      // así cada varita queda pegada al texto que le corresponde.
      var refe = objetivo.nextElementSibling;
      var punto = (refe && refe.classList && refe.classList.contains('ai-wand')) ? refe.nextSibling : objetivo.nextSibling;
      objetivo.parentNode.insertBefore(extra, punto);
    }

    // Trabajos incluidos: se rehace la lista con los del presupuesto.
    var lista = document.getElementById('worksList');
    if (lista && Array.isArray(textos.trabajos) && textos.trabajos.length) {
      lista.innerHTML = '';
      textos.trabajos.forEach(function (t) {
        var li = document.createElement('li');
        var span = document.createElement('span');
        span.className = 'p6-trabajo-text';
        span.contentEditable = 'true';
        span.setAttribute('data-ai-wand', 'trabajo');
        span.textContent = t;
        li.appendChild(span);
        var btn = document.createElement('button');
        btn.setAttribute('onclick', 'removeWorkItem(this)');
        btn.style.cssText = 'background:none;border:none;cursor:pointer;color:#C62828;font-size:13pt;line-height:1;padding:0;flex-shrink:0;margin-left:8px';
        btn.textContent = '×';
        li.appendChild(btn);
        lista.appendChild(li);
      });
    }

    var caja = document.getElementById('condicionesExtra');
    if (!caja || !Array.isArray(textos.condiciones) || !textos.condiciones.length) return;

    // Se quitan las de una importación anterior para no acumularlas.
    Array.prototype.forEach.call(caja.querySelectorAll('[data-ai-condicion]'), function (el) { el.remove(); });

    var numeroBase = caja.querySelectorAll('[data-condicion-num]').length + 5;
    textos.condiciones.forEach(function (c, i) {
      var bloque = document.createElement('div');
      bloque.setAttribute('data-ai-condicion', '1');
      bloque.style.cssText = 'padding:4mm 0;border-bottom:1px solid #F0EDE8';
      var titulo = document.createElement('div');
      titulo.contentEditable = 'true';
      titulo.style.cssText = "font-size:7pt;font-weight:700;color:#1A2236;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2mm;font-family:'DM Sans',Arial,sans-serif";
      titulo.textContent = (numeroBase + i) + '. ' + c.titulo;
      var texto = document.createElement('div');
      texto.contentEditable = 'true';
      texto.style.cssText = "font-size:7.5pt;color:#555;line-height:1.75;font-family:'DM Sans',Arial,sans-serif";
      texto.setAttribute('data-ai-wand', 'condicion');
      texto.textContent = c.texto;
      bloque.appendChild(titulo);
      bloque.appendChild(texto);
      caja.appendChild(bloque);
    });
  }

  function showBanner(payload) {
    var bar = document.createElement('div');
    bar.id = 'importBudgetBar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#1A2236;color:#fff;padding:10px 18px;display:flex;align-items:center;gap:14px;font-family:"DM Sans",Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.25);flex-wrap:wrap;';
    bar.innerHTML =
      '<div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#FED544;font-weight:700;">IMPORTAR PRESUPUESTO</div>' +
      '<div style="flex:1;font-size:12px;color:rgba(255,255,255,.75);min-width:200px;">' +
        'Hay un presupuesto preparado en la herramienta interna' +
        (payload.clientName ? ' para <strong>' + payload.clientName.replace(/</g, '&lt;') + '</strong>' : '') +
        ' · ' + payload.rows.length + ' partidas · total ' + fmtMoney(payload.total) + ' €' +
        (payload.textos ? ' · con textos y condiciones adaptados por IA (revisa que la página de condiciones no se desborde)' : '') +
        '. ¿Volcarlo a esta propuesta?' +
      '</div>' +
      '<button id="importBudgetYes" style="background:#FED544;color:#1A2236;border:none;padding:8px 16px;font-family:inherit;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;border-radius:4px;">Importar</button>' +
      '<button id="importBudgetNo" style="background:rgba(255,255,255,.08);color:#fff;border:none;padding:8px 14px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;border-radius:4px;cursor:pointer;font-family:inherit;">Descartar</button>';
    document.body.insertBefore(bar, document.body.firstChild);

    document.getElementById('importBudgetYes').addEventListener('click', function () {
      if (applyImport(payload)) {
        localStorage.removeItem(KEY);
        bar.style.background = '#1a8c4a';
        bar.children[1].innerHTML = 'Presupuesto importado ✓ — revisa las partidas y guarda como PDF o en el CRM.';
        setTimeout(function () { bar.remove(); }, 3500);
      }
    });
    document.getElementById('importBudgetNo').addEventListener('click', function () {
      localStorage.removeItem(KEY);
      bar.remove();
    });
  }

  function init() {
    var payload = readPayload();
    if (payload) showBanner(payload);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
