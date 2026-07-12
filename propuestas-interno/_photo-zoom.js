// Mejora de las fotos del bloque "Estado de situación":
//   - Toggle horizontal/vertical (cambia la altura del marco).
//   - Slider de zoom (100%–300%).
//   - Drag con el ratón para reposicionar la foto cuando hay zoom.
//
// Cómo funciona: cada `.estado-photo` recibe un hijo `.estado-photo-bg` que
// es la capa real con la imagen de fondo (background-size + background-position
// controlados desde JS). El `setEstadoPhoto` original se sobreescribe para
// pintar la imagen sobre la capa hija en vez de sobre el `<label>` padre.
// Un MutationObserver añade los controles a las cards creadas dinámicamente.

(function () {
  'use strict';

  var STYLES = '\
.estado-photo.is-portrait{height:260px;}\
.estado-photo-bg{position:absolute;inset:0;background-size:cover;background-position:center;background-repeat:no-repeat;pointer-events:none;}\
.estado-photo:not(.has-photo) .estado-photo-bg{display:none;}\
.estado-photo-controls{position:absolute;top:7px;right:7px;display:flex;flex-direction:column;gap:6px;z-index:3;opacity:0;transition:opacity .18s;}\
.estado-photo:hover .estado-photo-controls{opacity:1;}\
.estado-photo:not(.has-photo) .estado-photo-controls{display:none;}\
.estado-photo-btn{width:26px;height:26px;border-radius:4px;border:none;background:rgba(26,34,54,.8);color:#fff;font-size:13px;line-height:1;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;font-family:var(--sans,sans-serif);}\
.estado-photo-btn:hover{background:rgba(26,34,54,1);}\
.estado-photo-zoom{position:absolute;bottom:8px;left:8px;right:8px;z-index:3;opacity:0;transition:opacity .18s;background:rgba(26,34,54,.85);padding:6px 10px;border-radius:4px;display:flex;align-items:center;gap:8px;}\
.estado-photo:hover .estado-photo-zoom{opacity:1;}\
.estado-photo:not(.has-photo) .estado-photo-zoom{display:none;}\
.estado-photo-zoom input[type=range]{flex:1;margin:0;height:14px;cursor:pointer;}\
.estado-photo-zoom-label{color:#fff;font-family:var(--sans,sans-serif);font-size:9px;min-width:34px;text-align:right;}\
.estado-photo.has-photo{cursor:grab;}\
.estado-photo.is-dragging{cursor:grabbing;}\
@media print{.estado-photo-controls,.estado-photo-zoom{display:none !important;}.estado-photo{cursor:default !important;}}\
';

  function injectStyles() {
    if (document.getElementById('photoZoomStyles')) return;
    var s = document.createElement('style');
    s.id = 'photoZoomStyles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  function enhance(photoEl) {
    if (!photoEl) return;
    // El flag se setea en cada enhance() válido y la propia función almacena el
    // observer en photoEl._zoomMo. Si el flag está pero el observer NO, es un
    // clon (los listeners no se copian con cloneNode): limpiamos artefactos
    // heredados y re-inicializamos desde cero. Si flag y observer existen,
    // ya está enhance-ado correctamente y salimos para no duplicar.
    if (photoEl.dataset.zoomEnhanced) {
      if (photoEl._zoomMo) return; // ya inicializado en esta sesión
      // Clon: stripear y reinicializar
      photoEl.querySelectorAll(':scope > .estado-photo-bg, :scope > .estado-photo-controls, :scope > .estado-photo-zoom').forEach(function(n){ n.remove(); });
      photoEl.style.backgroundImage = '';
      photoEl.classList.remove('has-photo','is-portrait','is-dragging');
      delete photoEl.dataset.zoomEnhanced;
    }
    photoEl.dataset.zoomEnhanced = '1';

    var bg = document.createElement('div');
    bg.className = 'estado-photo-bg';
    photoEl.appendChild(bg);

    var controls = document.createElement('div');
    controls.className = 'estado-photo-controls';
    var orientBtn = document.createElement('button');
    orientBtn.type = 'button';
    orientBtn.className = 'estado-photo-btn';
    orientBtn.title = 'Cambiar orientación';
    orientBtn.textContent = '⇅';
    orientBtn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      photoEl.classList.toggle('is-portrait');
    });
    controls.appendChild(orientBtn);
    photoEl.appendChild(controls);

    var zoomBox = document.createElement('div');
    zoomBox.className = 'estado-photo-zoom';
    var slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '100';
    slider.max = '300';
    slider.step = '1';
    slider.value = '100';
    var label = document.createElement('span');
    label.className = 'estado-photo-zoom-label';
    label.textContent = '100%';
    zoomBox.appendChild(slider);
    zoomBox.appendChild(label);
    // El zoomBox no abre el selector de archivo
    zoomBox.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); });
    zoomBox.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
    photoEl.appendChild(zoomBox);

    var state = { x: 50, y: 50, zoom: 100 };
    function apply() {
      // En zoom mínimo (100%) mostramos la foto completa con 'contain' para no recortar.
      // A partir de 101% usamos porcentaje real para hacer zoom-in.
      bg.style.backgroundSize = state.zoom <= 100 ? 'contain' : state.zoom + '%';
      bg.style.backgroundPosition = state.x + '% ' + state.y + '%';
      label.textContent = state.zoom + '%';
    }

    slider.addEventListener('input', function (ev) {
      ev.stopPropagation();
      state.zoom = parseInt(slider.value, 10) || 100;
      apply();
    });

    // Drag para reposicionar
    var dragging = false, sx, sy, sBgX, sBgY, ptrId;
    photoEl.addEventListener('pointerdown', function (ev) {
      if (!photoEl.classList.contains('has-photo')) return;
      // No arrastrar si el click fue sobre los controles
      if (ev.target.closest('.estado-photo-controls')) return;
      if (ev.target.closest('.estado-photo-zoom')) return;
      dragging = true;
      photoEl.classList.add('is-dragging');
      sx = ev.clientX; sy = ev.clientY;
      sBgX = state.x; sBgY = state.y;
      ptrId = ev.pointerId;
      try { photoEl.setPointerCapture(ptrId); } catch (e) {}
      ev.preventDefault();
    });
    photoEl.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      var rect = photoEl.getBoundingClientRect();
      // Sensibilidad: mover N px en pantalla = mover N% de background-position
      // ajustada por el factor de zoom (a más zoom, menos sensibilidad).
      var factor = state.zoom / 100;
      var dx = (ev.clientX - sx) / rect.width * 100 / factor;
      var dy = (ev.clientY - sy) / rect.height * 100 / factor;
      state.x = Math.max(0, Math.min(100, sBgX - dx));
      state.y = Math.max(0, Math.min(100, sBgY - dy));
      apply();
    });
    function endDrag(ev) {
      if (!dragging) return;
      dragging = false;
      photoEl.classList.remove('is-dragging');
      try { photoEl.releasePointerCapture(ptrId); } catch (e) {}
    }
    photoEl.addEventListener('pointerup', endDrag);
    photoEl.addEventListener('pointercancel', endDrag);

    // Detecta cuando el setEstadoPhoto original pinta la imagen sobre el padre
    // y la transfiere a la capa .estado-photo-bg (reseteando estado).
    function transferBg() {
      var inline = photoEl.style.backgroundImage;
      if (!inline || inline === 'none') return;
      bg.style.backgroundImage = inline;
      photoEl.style.backgroundImage = '';
      state.x = 50; state.y = 50; state.zoom = 100;
      slider.value = '100';
      apply();
    }
    var mo = new MutationObserver(transferBg);
    mo.observe(photoEl, { attributes: true, attributeFilter: ['style'] });
    photoEl._zoomMo = mo; // marca para detectar enhance previo en esta sesión
    // Por si ya tenía imagen al inicializar
    transferBg();
  }

  function enhanceAll(root) {
    (root || document).querySelectorAll('.estado-photo').forEach(enhance);
  }

  function watchNewCards() {
    var mo = new MutationObserver(function (records) {
      records.forEach(function (rec) {
        rec.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.classList && node.classList.contains('estado-photo')) enhance(node);
          enhanceAll(node);
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    injectStyles();
    enhanceAll(document);
    watchNewCards();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
