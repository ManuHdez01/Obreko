// Cálculo unificado del presupuesto + nuevas columnas con formato consistente.
//   - Sobrescribe addBudgetCol → crea inputs numéricos con el mismo formato que MAT/MO
//     (alineados a la derecha, font-size 9px, clase .price-input).
//   - Sobrescribe calcBudget → suma mat + mano de obra + columnas custom en cada fila
//     y en los subtotales del cuadro de totales.
//   - Crea una fila de subtotal por cada columna custom dentro del .totals-box,
//     etiquetada con el nombre del header (se sincroniza al editarlo).
//   - Soporta varias convenciones de IDs presentes en distintas propuestas:
//        Convención A: subtotalMat + subtotalLab + baseImp + ivaAmt + grandTotal
//        Convención B: subtotal (=mat) + baseImp + iva + grand
//        Convención C: subtotal (=base) + iva + grand
//   - Añade aliases window.calcRow y window.calcTotals (los HTML los referencian).

(function () {
  'use strict';

  function parseNum(el) {
    if (!el) return 0;
    var text = el.tagName === 'INPUT' ? (el.value || '') : (el.textContent || '');
    var n = parseFloat(text.replace(/[^\d.,-]/g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }

  function fmtMoney(n) {
    return n > 0
      ? n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
      : '—';
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  // El selector IVA/IGIC manda: si está activo, su tipo es el bueno. El campo
  // #ivaRate solo existe en algunas plantillas antiguas, y quedarse con él hacía
  // que una propuesta canaria saliera con el 21%.
  function getIvaRate() {
    if (typeof window.getTaxRate === 'function') {
      var r = window.getTaxRate();
      if (isFinite(r)) return r;
    }
    var el = document.getElementById('ivaRate');
    if (!el) return 0.21;
    var n = parseFloat((el.value || '21').replace(',', '.'));
    return isFinite(n) ? n / 100 : 0.21;
  }

  // Etiqueta del impuesto en la fila de totales ("IVA 21%" / "IGIC 7%").
  function pintarEtiquetaImpuesto() {
    if (typeof window.getTaxLabel !== 'function') return;
    var etiqueta = window.getTaxLabel();
    Array.prototype.forEach.call(document.querySelectorAll('[data-tax-label]'), function (el) {
      el.textContent = etiqueta;
    });
  }

  function customCellsInRow(tr) {
    return tr.querySelectorAll('[data-type="custom"]');
  }

  function calcBudget() {
    pintarEtiquetaImpuesto();
    var rows = document.querySelectorAll('#budgetBody tr');
    var subMat = 0, subLab = 0;
    var customSums = Object.create(null);

    rows.forEach(function (tr) {
      if (tr.classList.contains('cat-row')) return;
      var m = tr.querySelector('[data-type="mat"]');
      var l = tr.querySelector('[data-type="labor"]');
      var qEl = tr.querySelector('[data-type="qty"]');
      var unit = parseNum(m) + parseNum(l);

      customCellsInRow(tr).forEach(function (c) {
        var key = c.dataset.customKey;
        if (!key) return;
        var v = parseNum(c);
        unit += v;
        customSums[key] = (customSums[key] || 0) + v * (qEl ? (parseNum(qEl) || 1) : 1);
      });

      var qty = qEl ? (parseNum(qEl) || 1) : 1;
      var rowSum = unit * qty;

      var tot = tr.querySelector('[data-type="rowtotal"]');
      if (tot) tot.textContent = fmtMoney(rowSum);
      if (m) subMat += parseNum(m) * qty;
      if (l) subLab += parseNum(l) * qty;
    });

    var customTotal = 0;
    Object.keys(customSums).forEach(function (k) { customTotal += customSums[k]; });
    var base = subMat + subLab + customTotal;
    var iva = base * getIvaRate();
    var grand = base + iva;

    var hasSubMat = !!document.getElementById('subtotalMat');
    var hasBaseImp = !!document.getElementById('baseImp');

    setText('subtotalMat', fmtMoney(subMat));
    setText('subtotalLab', fmtMoney(subLab));
    if (hasSubMat) {
      // Convención A: 'subtotal' raramente existe; lo poblamos por si acaso a la base
      setText('subtotal', fmtMoney(base));
    } else if (hasBaseImp) {
      // Convención B: 'subtotal' = mat (etiquetado "Subtotal materiales")
      setText('subtotal', fmtMoney(subMat));
    } else {
      // Convención C: 'subtotal' = base
      setText('subtotal', fmtMoney(base));
    }
    setText('baseImp', fmtMoney(base));
    setText('ivaAmt', fmtMoney(iva));
    setText('iva', fmtMoney(iva));
    setText('grandTotal', fmtMoney(grand));
    setText('grand', fmtMoney(grand));

    Object.keys(customSums).forEach(function (key) {
      setText('subtotalCustom_' + key, fmtMoney(customSums[key]));
    });
  }

  function addCustomSubtotalRow(key, headerEl) {
    if (document.getElementById('rowSubCustom_' + key)) return;
    var totalsBox = document.querySelector('.totals-box');
    if (!totalsBox) return;
    var rowLab = document.getElementById('rowSubLabor');
    var rowMat = document.getElementById('rowSubMat');
    var anchor = rowLab || rowMat || null;

    var div = document.createElement('div');
    div.className = 'totals-row';
    div.id = 'rowSubCustom_' + key;
    var label = (headerEl && headerEl.textContent) ? headerEl.textContent.trim() : 'Columna';
    div.innerHTML = '<button class="toggle-row-btn" onclick="toggleTotalsRow(\'' + div.id + '\')" title="Mostrar / ocultar">👁</button><span class="custom-label">' + label + '</span><span id="subtotalCustom_' + key + '">—</span>';

    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(div, anchor.nextSibling);
    } else {
      totalsBox.insertBefore(div, totalsBox.firstChild);
    }
  }

  function removeCustomSubtotalRow(key) {
    var row = document.getElementById('rowSubCustom_' + key);
    if (row && row.parentNode) row.parentNode.removeChild(row);
  }

  function makeCustomInput(key) {
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'price-input';
    input.dataset.type = 'custom';
    input.dataset.customKey = key;
    input.placeholder = '—';
    input.style.cssText = 'width:72px;background:transparent;border:none;border-bottom:1px solid #e0e0e0;font-family:var(--sans,"DM Sans",Arial,sans-serif);font-size:9px;color:var(--navy,#1A2236);padding:2px 0;outline:none;text-align:right;';
    input.addEventListener('input', calcBudget);
    return input;
  }

  function addBudgetCol() {
    var tbl = document.getElementById('budgetTable');
    if (!tbl) return;
    var existingCustom = tbl.querySelectorAll('thead tr th[data-custom]');
    var n = existingCustom.length + 1;
    var key = 'c' + Date.now() + '_' + n;
    var newHeader = null;

    tbl.querySelectorAll('tr').forEach(function (tr, i) {
      // Filas especiales de totales en algunas plantillas (reformas.html)
      if (tr.classList.contains('p7-sub-row') || tr.classList.contains('p7-iva-row') || tr.classList.contains('p7-total-row')) {
        var tdSpec = document.createElement('td');
        tdSpec.dataset.customExtra = 'true';
        if (tr.lastElementChild) tr.insertBefore(tdSpec, tr.lastElementChild);
        return;
      }
      // Filas de categoría visual no llevan input
      if (tr.classList.contains('cat-row')) {
        var tdCat = document.createElement('td');
        tdCat.dataset.customExtra = 'true';
        if (tr.lastElementChild) tr.insertBefore(tdCat, tr.lastElementChild); else tr.appendChild(tdCat);
        return;
      }

      var cells = tr.querySelectorAll('th,td');
      if (!cells.length) return;
      var last = cells[cells.length - 1];

      if (i === 0) {
        var th = document.createElement('th');
        th.contentEditable = 'true';
        th.dataset.custom = 'true';
        th.dataset.customKey = key;
        th.style.textAlign = 'right';
        th.textContent = 'Columna ' + n;
        tr.insertBefore(th, last);
        newHeader = th;
        // Sincronizar label del subtotal cuando edita el header
        th.addEventListener('input', function () {
          var lbl = document.querySelector('#rowSubCustom_' + key + ' .custom-label');
          if (lbl) lbl.textContent = (th.textContent || 'Columna').trim();
        });
      } else {
        var td = document.createElement('td');
        td.style.cssText = 'padding:7px 11px;border-bottom:1px solid #ebebeb;text-align:right;vertical-align:middle;';
        td.appendChild(makeCustomInput(key));
        tr.insertBefore(td, last);
      }
    });

    addCustomSubtotalRow(key, newHeader);
    calcBudget();
  }

  function removeBudgetLastCustomCol() {
    var tbl = document.getElementById('budgetTable');
    if (!tbl) return;
    var headers = Array.from(tbl.querySelectorAll('thead tr th'));
    var customs = headers.filter(function (h) { return h.dataset.custom === 'true'; });
    if (!customs.length) return;
    var lastCustom = customs[customs.length - 1];
    var key = lastCustom.dataset.customKey;
    var lastIdx = headers.indexOf(lastCustom);

    tbl.querySelectorAll('tr').forEach(function (tr) {
      var cells = tr.querySelectorAll('th,td');
      if (cells[lastIdx]) cells[lastIdx].remove();
    });

    // Limpiar también los <td data-custom-extra> que se hayan podido añadir en filas especiales
    tbl.querySelectorAll('[data-custom-extra="true"]').forEach(function (td, idx, arr) {
      // borramos solo el último de cada fila para mantener simetría
      var tr = td.parentNode;
      if (!tr) return;
      var siblings = tr.querySelectorAll('[data-custom-extra="true"]');
      // si hay más extras que custom-headers, eliminar el último
      var customHeaders = tbl.querySelectorAll('thead tr th[data-custom]').length;
      if (siblings.length > customHeaders) td.remove();
    });

    if (key) removeCustomSubtotalRow(key);
    calcBudget();
  }

  // Hook listeners en celdas existentes (mat, labor, qty) y en el rate de IVA
  function hookInputs() {
    document.querySelectorAll('[data-type="mat"],[data-type="labor"],[data-type="qty"]').forEach(function (el) {
      if (el.dataset.calcHooked) return;
      el.dataset.calcHooked = '1';
      el.addEventListener('input', calcBudget);
    });
    var iva = document.getElementById('ivaRate');
    if (iva && !iva.dataset.calcHooked) {
      iva.dataset.calcHooked = '1';
      iva.addEventListener('input', calcBudget);
    }
  }

  function init() {
    // Sobrescribir globales después del script inline
    window.calcBudget = calcBudget;
    window.calcRow = calcBudget;
    window.calcTotals = calcBudget;
    window.addBudgetCol = addBudgetCol;
    window.removeBudgetLastCustomCol = removeBudgetLastCustomCol;

    hookInputs();
    calcBudget();

    // Reenganchar inputs cuando se añadan filas dinámicamente.
    // OJO: NO llamar a calcBudget desde el observer: textContent='—' dispara
    // childList y se forma un bucle infinito. El cálculo lo dispara el oninput.
    var body = document.getElementById('budgetBody');
    if (body) {
      var mo = new MutationObserver(function (records) {
        var hasAdds = records.some(function (r) { return r.addedNodes && r.addedNodes.length > 0; });
        if (hasAdds) hookInputs();
      });
      mo.observe(body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
