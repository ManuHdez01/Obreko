// Convierte los inputs de texto de las columnas Partida/Descripción del
// presupuesto en <textarea> auto-ajustables, de modo que el texto largo
// haga salto de línea en lugar de cortarse por otra columna.
// Los inputs de precio (.price-input) y de IVA (.iva-input) no se tocan.

(function () {
  'use strict';

  function autoresize(ta) {
    ta.style.height = 'auto';
    ta.style.height = (ta.scrollHeight + 2) + 'px';
  }

  function upgradeInput(inp) {
    if (!inp || inp.tagName !== 'INPUT') return;
    if (inp.classList.contains('price-input')) return;
    if (inp.classList.contains('iva-input')) return;
    if (inp.type && inp.type !== 'text') return;

    var ta = document.createElement('textarea');
    ta.rows = 1;
    // Copiar atributos relevantes (value, placeholder, class, oninput, etc.)
    Array.prototype.slice.call(inp.attributes).forEach(function (a) {
      if (a.name === 'type') return;
      ta.setAttribute(a.name, a.value);
    });
    ta.value = inp.value || '';
    // Estilo minimal para mantener apariencia del input
    ta.style.cssText =
      'width:100%;background:transparent;border:none;border-bottom:1px solid #e0e0e0;' +
      'font:inherit;font-size:10px;color:inherit;padding:2px 0;outline:none;resize:none;' +
      'overflow:hidden;line-height:1.45;display:block;box-sizing:border-box;';
    ta.addEventListener('focus', function () {
      ta.style.borderBottomColor = 'var(--blue, #5C7CD9)';
    });
    ta.addEventListener('blur', function () {
      ta.style.borderBottomColor = '#e0e0e0';
    });
    ta.addEventListener('input', function () { autoresize(ta); });
    inp.parentNode.replaceChild(ta, inp);
    autoresize(ta);
  }

  function isPriceCol(td) {
    // td que contenga price-input o que sea la columna de total calculado
    if (!td) return true;
    if (td.classList && (td.classList.contains('line-total') || td.classList.contains('cat-row'))) return true;
    if (td.querySelector && td.querySelector('.price-input')) return true;
    return false;
  }

  function run() {
    document.querySelectorAll('.budget-table tbody tr').forEach(function (tr) {
      if (tr.classList.contains('cat-row')) return;
      // Iterar tds; columna 1 suele ser número; saltamos primero ancho fijo.
      Array.prototype.forEach.call(tr.cells, function (td, i) {
        if (i === 0) return; // número
        if (isPriceCol(td)) return;
        var inp = td.querySelector('input[type="text"]');
        if (inp) upgradeInput(inp);
      });
    });

    // Print friendly: asegurar que los textareas no se corten al imprimir
    if (!document.getElementById('budgetWrapStyles')) {
      var s = document.createElement('style');
      s.id = 'budgetWrapStyles';
      s.textContent =
        '.budget-table td{vertical-align:top;}\n' +
        '@media print{.budget-table textarea{border:none !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}}';
      document.head.appendChild(s);
    }
  }

  // Reejecutar cuando se añaden filas nuevas (p.ej. al pulsar + partida)
  var mo;
  function watchBudget() {
    var tbodies = document.querySelectorAll('.budget-table tbody');
    if (!tbodies.length) return;
    mo = new MutationObserver(function () { run(); });
    tbodies.forEach(function (tb) {
      mo.observe(tb, { childList: true, subtree: true });
    });
  }

  function init() {
    run();
    watchBudget();
    window.addEventListener('beforeprint', run);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
