// Numera automáticamente las páginas intermedias de una propuesta.
// Excluye: primera página (portada) y última página (cierre / firma).
// Formato: "3 / 8" en esquina inferior centrada, estilo sobrio.

(function () {
  'use strict';

  function isInterstitialBlank(el) {
    return el.classList.contains('blank-page');
  }

  function addPageNumbers() {
    const allPages = Array.from(document.querySelectorAll('.page')).filter(
      (p) => !isInterstitialBlank(p)
    );
    if (allPages.length < 3) return; // no tiene sentido si hay 2 o menos

    // Páginas a numerar: todas menos la primera (portada).
    const intermediate = allPages.slice(1);
    const total = intermediate.length;

    intermediate.forEach((page, idx) => {
      // Evitar duplicados si el script se ejecuta dos veces
      const existing = page.querySelector('.page-number-badge');
      if (existing) existing.remove();

      // Asegurar que la página tenga position:relative para el absolute del badge
      const cs = window.getComputedStyle(page);
      if (cs.position === 'static') {
        page.style.position = 'relative';
      }

      const badge = document.createElement('div');
      badge.className = 'page-number-badge';
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = (idx + 1) + ' / ' + total;
      page.appendChild(badge);
    });
  }

  function injectStyles() {
    if (document.getElementById('page-number-styles')) return;
    const s = document.createElement('style');
    s.id = 'page-number-styles';
    s.textContent = `
      .page-number-badge{
        position:absolute;left:50%;bottom:8mm;transform:translateX(-50%);
        font-family:'DM Sans',Arial,sans-serif;font-size:7.5pt;color:#8896B3;
        letter-spacing:.12em;pointer-events:none;z-index:5;
        font-variant-numeric:tabular-nums;
      }
      @media print{
        .page-number-badge{color:#8896B3 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      }
    `;
    document.head.appendChild(s);
  }

  function init() {
    injectStyles();
    addPageNumbers();
    // Re-numerar antes y después de imprimir por si hay lógica que añade/quita páginas
    window.addEventListener('beforeprint', addPageNumbers);
    window.addEventListener('afterprint', addPageNumbers);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
