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

    if (typeof window.calcBudget === 'function') window.calcBudget();
    return true;
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
        ' · ' + payload.rows.length + ' partidas · total ' + fmtMoney(payload.total) + ' €. ¿Volcarlo a esta propuesta?' +
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
