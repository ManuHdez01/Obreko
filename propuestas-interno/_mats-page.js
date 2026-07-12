// _mats-page.js
// Inyecta la página "Materiales, mobiliario y electrodomésticos principales sugeridos"
// en propuestas que tengan un elemento <div data-mats-page-here></div>.
// Cada propuesta declara dónde insertar la página colocando ese marcador.
// Reusa setEstadoPhoto y la infraestructura .estado-photo existente.

(function () {
  'use strict';

  var STYLES = '\
.mats-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin:14px 0 12px;}\
.mat-card{position:relative;border:1px solid #e0e0e0;background:#fff;display:flex;flex-direction:column;}\
.mat-card .estado-photo{height:140px;border-bottom:1.5px dashed var(--blue,#5C7CD9);}\
.mat-body{padding:10px 12px 12px;display:flex;flex-direction:column;gap:4px;}\
.mat-label{font-family:var(--sans,DM Sans);font-size:7.5px;text-transform:uppercase;letter-spacing:.14em;color:var(--blue,#5C7CD9);font-weight:700;margin-top:6px;margin-bottom:1px;}\
.mat-label:first-child{margin-top:0;}\
.mat-text{font-family:var(--sans,DM Sans);font-size:10px;color:var(--navy,#1A2236);line-height:1.5;min-height:20px;}\
.mat-text:empty::before{content:attr(data-placeholder);color:#b8b8b8;font-style:italic;}\
.mats-note{font-family:var(--sans,DM Sans);font-size:10px;color:var(--navy,#1A2236);line-height:1.6;margin-top:14px;background:rgba(254,213,68,.07);border-left:3px solid var(--yellow,#FED544);padding:10px 14px;}\
@media print{.mats-grid .estado-remove-btn,.mats-add-btn{display:none !important;}}\
';

  function makeMatCard(opts) {
    opts = opts || {};
    var card = document.createElement('div');
    card.className = 'mat-card';
    card.innerHTML = '<button type="button" class="estado-remove-btn" onclick="removeMatCard(this)" title="Eliminar">×</button>' +
      '<label class="estado-photo">' +
        '<input type="file" accept="image/*" onchange="setEstadoPhoto(this)" hidden>' +
        '<div class="estado-photo-placeholder"><span>Clic para añadir foto</span></div>' +
        '<div class="estado-photo-hint">Clic para cambiar</div>' +
      '</label>' +
      '<div class="mat-body">' +
        '<div class="mat-label">ELEMENTO</div>' +
        '<div class="mat-text" contenteditable="true" data-placeholder="' + (opts.elementoHint || 'Ej. Azulejos blanco mate') + '">' + (opts.elemento || '') + '</div>' +
        '<div class="mat-label">ZONA</div>' +
        '<div class="mat-text" contenteditable="true" data-placeholder="' + (opts.zonaHint || 'Ej. Baño') + '">' + (opts.zona || '') + '</div>' +
      '</div>';
    return card;
  }

  window.addMatCard = function () {
    var grid = document.getElementById('matsGrid');
    if (!grid) return;
    grid.appendChild(makeMatCard());
    if (typeof scalePages === 'function') scalePages();
  };

  window.removeMatCard = function (btn) {
    var card = btn.closest('.mat-card');
    if (card) card.remove();
  };

  function buildPage() {
    var marker = document.querySelector('[data-mats-page-here]');
    if (!marker) return;

    var page = document.createElement('div');
    page.className = 'page';
    page.innerHTML =
      '<div class="page-inner">' +
        '<div class="section-label" contenteditable="true">VISIÓN GENERAL DEL DISEÑO</div>' +
        '<h1 class="page-h1" contenteditable="true">Materiales, mobiliario y electrodomésticos <em>sugeridos</em></h1>' +
        '<div class="yellow-rule"></div>' +
        '<p class="qs-body" contenteditable="true" style="margin-top:14px;margin-bottom:6px;">Los siguientes elementos visualizan el concepto general de diseño, colores y uniformidad de la actuación: pintura, muebles, cabeceros, azulejos, alicatado y electrodomésticos principales.</p>' +
        '<div id="matsGrid" class="mats-grid"></div>' +
        '<button type="button" class="estado-add-btn mats-add-btn" onclick="addMatCard()">Añadir material / mobiliario</button>' +
        '<div class="mats-note" contenteditable="true">De este modo se "visualiza" el concepto general de diseño, colores y uniformidad de toda la actuación en los principales elementos: colores de pintura general, colores de muebles, cabeceros, azulejos, alicatado, etc.</div>' +
      '</div>';

    marker.parentNode.insertBefore(page, marker);

    // 3 cards iniciales con ejemplos
    var grid = page.querySelector('#matsGrid');
    grid.appendChild(makeMatCard({ elementoHint: 'Ej. Azulejos', zonaHint: 'Ej. Baño' }));
    grid.appendChild(makeMatCard({ elementoHint: 'Ej. Cabeceros para camas', zonaHint: 'Ej. Habitaciones' }));
    grid.appendChild(makeMatCard({ elementoHint: 'Ej. Pintura interior', zonaHint: 'Ej. Salón / pasillos' }));
  }

  function injectStyles() {
    if (document.getElementById('mats-page-styles')) return;
    var s = document.createElement('style');
    s.id = 'mats-page-styles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  function init() {
    injectStyles();
    buildPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
