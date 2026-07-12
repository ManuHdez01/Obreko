// Mini-toolbar flotante sobre las celdas de texto del presupuesto.
//   - Aparece al enfocar una celda PARTIDA/DESCRIPCIÓN (textarea o contenteditable).
//   - Excluye las celdas numéricas (price-input, iva-input, [data-type=mat|labor|custom])
//     porque ahí no tiene sentido aplicar formato.
//   - Botones: Negrita (B), Izquierda, Centro, Derecha, Justificado.
//   - El formato se aplica a toda la celda (no a selección parcial) — es lo coherente
//     para textareas. Para celdas contenteditable también aplica al elemento entero.
//   - Oculto al imprimir.

(function () {
  'use strict';

  var STYLES = '\
.bf-toolbar{position:fixed;z-index:9999;background:#1A2236;color:#fff;border:1px solid #FED544;padding:3px;display:flex;gap:2px;box-shadow:0 4px 14px rgba(0,0,0,.28);font-family:"DM Sans",Arial,sans-serif;border-radius:3px;}\
.bf-btn{background:transparent;border:1px solid transparent;color:#fff;cursor:pointer;width:28px;height:24px;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;padding:0;border-radius:2px;transition:background .12s,border-color .12s;font-family:inherit;}\
.bf-btn:hover{background:rgba(254,213,68,.18);}\
.bf-btn.is-active{background:#FED544;color:#1A2236;border-color:#FED544;}\
.bf-btn .bf-ico{display:inline-block;line-height:1;}\
.bf-sep{width:1px;background:rgba(255,255,255,.18);margin:0 2px;}\
@media print{.bf-toolbar{display:none !important;}}\
';

  var toolbar = null;
  var currentTarget = null;

  function injectStyles() {
    if (document.getElementById('bfStyles')) return;
    var s = document.createElement('style');
    s.id = 'bfStyles';
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  // Iconos SVG inline para alineación (más fiables que emojis)
  var ICONS = {
    bold: '<span class="bf-ico" style="font-weight:900;font-family:Georgia,serif;">B</span>',
    left: '<svg class="bf-ico" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="3" width="10" height="1.5"/><rect x="2" y="6" width="8" height="1.5"/><rect x="2" y="9" width="12" height="1.5"/><rect x="2" y="12" width="9" height="1.5"/></svg>',
    center: '<svg class="bf-ico" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="10" height="1.5"/><rect x="4" y="6" width="8" height="1.5"/><rect x="2" y="9" width="12" height="1.5"/><rect x="3.5" y="12" width="9" height="1.5"/></svg>',
    right: '<svg class="bf-ico" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="10" height="1.5"/><rect x="6" y="6" width="8" height="1.5"/><rect x="2" y="9" width="12" height="1.5"/><rect x="5" y="12" width="9" height="1.5"/></svg>',
    justify: '<svg class="bf-ico" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="3" width="12" height="1.5"/><rect x="2" y="6" width="12" height="1.5"/><rect x="2" y="9" width="12" height="1.5"/><rect x="2" y="12" width="12" height="1.5"/></svg>',
  };

  function makeToolbar() {
    if (toolbar) return toolbar;
    toolbar = document.createElement('div');
    toolbar.className = 'bf-toolbar';
    toolbar.style.display = 'none';

    var actions = [
      { html: ICONS.bold, title: 'Negrita', cmd: 'bold' },
      { sep: true },
      { html: ICONS.left, title: 'Alinear a la izquierda', cmd: 'left' },
      { html: ICONS.center, title: 'Centrar', cmd: 'center' },
      { html: ICONS.right, title: 'Alinear a la derecha', cmd: 'right' },
      { html: ICONS.justify, title: 'Justificar', cmd: 'justify' },
    ];

    actions.forEach(function (a) {
      if (a.sep) {
        var sp = document.createElement('div');
        sp.className = 'bf-sep';
        toolbar.appendChild(sp);
        return;
      }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bf-btn';
      btn.title = a.title;
      btn.innerHTML = a.html;
      btn.dataset.cmd = a.cmd;
      // mousedown en lugar de click para no perder el foco de la celda
      btn.addEventListener('mousedown', function (ev) {
        ev.preventDefault();
      });
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        if (!currentTarget) return;
        applyCommand(currentTarget, a.cmd);
        updateState();
      });
      toolbar.appendChild(btn);
    });

    // Click sobre el toolbar no debe ocultar el panel
    toolbar.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
    document.body.appendChild(toolbar);
    return toolbar;
  }

  function applyCommand(target, cmd) {
    if (cmd === 'bold') {
      var fw = target.style.fontWeight;
      target.style.fontWeight = (fw === 'bold' || fw === '700') ? '' : 'bold';
    } else {
      target.style.textAlign = cmd;
    }
  }

  function updateState() {
    if (!toolbar || !currentTarget) return;
    var btns = toolbar.querySelectorAll('.bf-btn');
    var fw = currentTarget.style.fontWeight;
    var ta = (currentTarget.style.textAlign || getComputedStyle(currentTarget).textAlign);
    btns.forEach(function (b) {
      var cmd = b.dataset.cmd;
      if (cmd === 'bold') b.classList.toggle('is-active', fw === 'bold' || fw === '700');
      else b.classList.toggle('is-active', ta === cmd);
    });
  }

  function isTargetable(el) {
    if (!el) return false;
    if (el.classList && (el.classList.contains('price-input') || el.classList.contains('iva-input'))) return false;
    var dt = el.dataset && el.dataset.type;
    if (dt === 'mat' || dt === 'labor' || dt === 'custom') return false;
    if (!el.closest || !el.closest('.budget-table')) return false;
    return el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable;
  }

  function position(target) {
    var rect = target.getBoundingClientRect();
    toolbar.style.display = 'flex';
    // Forzar layout para medir altura/anchura correctamente
    var th = toolbar.offsetHeight, tw = toolbar.offsetWidth;
    var top = rect.top - th - 6;
    if (top < 8) top = rect.bottom + 6;
    var left = rect.left;
    if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
    if (left < 8) left = 8;
    toolbar.style.top = top + 'px';
    toolbar.style.left = left + 'px';
  }

  function showFor(target) {
    if (!toolbar) makeToolbar();
    currentTarget = target;
    position(target);
    updateState();
  }

  function hide() {
    if (toolbar) toolbar.style.display = 'none';
    currentTarget = null;
  }

  document.addEventListener('focusin', function (ev) {
    if (isTargetable(ev.target)) {
      showFor(ev.target);
    } else if (!ev.target.closest || !ev.target.closest('.bf-toolbar')) {
      hide();
    }
  });

  document.addEventListener('focusout', function (ev) {
    if (!isTargetable(ev.target)) return;
    setTimeout(function () {
      var active = document.activeElement;
      if (!isTargetable(active) && !(active && active.closest && active.closest('.bf-toolbar'))) {
        hide();
      }
    }, 100);
  });

  function reposition() {
    if (currentTarget && toolbar && toolbar.style.display !== 'none') position(currentTarget);
  }
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);

  function init() {
    injectStyles();
    makeToolbar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
