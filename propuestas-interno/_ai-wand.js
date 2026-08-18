// Varita de redacción (✨) para los textos de la propuesta.
//
// Pone un botón discreto al lado de cada bloque de texto marcado con
// data-ai-wand. Al pulsarlo pide a la IA tres redacciones alternativas para
// ESE bloque, teniendo en cuenta la obra (tipo, metros, dirección, capítulos
// del presupuesto), y las muestra para elegir. El bloque sigue siendo
// editable a mano antes y después: la varita sugiere, no impone.
//
// El contexto de la obra lo deja la herramienta de presupuestos al importar,
// en localStorage['obreko_proposal_ctx'].

(function () {
  'use strict';

  var CTX_KEY = 'obreko_proposal_ctx';
  var API = '/api/budget-tool/propuesta-sugerencias';

  function contexto() {
    try {
      return JSON.parse(localStorage.getItem(CTX_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function cerrarPopover() {
    var previo = document.getElementById('aiWandPop');
    if (previo) previo.remove();
  }

  function popover(boton, contenido) {
    cerrarPopover();
    var pop = document.createElement('div');
    pop.id = 'aiWandPop';
    pop.style.cssText = 'position:absolute;z-index:9999;max-width:420px;background:#1A2236;color:#fff;' +
      'border-radius:8px;padding:10px;font-family:"DM Sans",Arial,sans-serif;font-size:11px;line-height:1.6;' +
      'box-shadow:0 10px 30px rgba(0,0,0,.35)';
    var r = boton.getBoundingClientRect();
    pop.style.top = (window.scrollY + r.bottom + 6) + 'px';
    pop.style.left = Math.max(8, window.scrollX + r.left - 200) + 'px';
    pop.appendChild(contenido);
    document.body.appendChild(pop);
    return pop;
  }

  function texto(el, valor) {
    if (valor != null) el.textContent = valor;
    return el.textContent.trim();
  }

  async function pedirAlternativas(bloque, textoActual) {
    var res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bloque: bloque, textoActual: textoActual, contexto: contexto() }),
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('Error ' + res.status));
    return data.alternativas || [];
  }

  function mostrarAlternativas(boton, el, alternativas) {
    var caja = document.createElement('div');
    var titulo = document.createElement('div');
    titulo.textContent = 'Elige una redacción (o sigue escribiendo tú)';
    titulo.style.cssText = 'font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#8896B3;margin-bottom:8px';
    caja.appendChild(titulo);

    var original = texto(el);
    alternativas.forEach(function (alt) {
      var opcion = document.createElement('div');
      opcion.textContent = alt;
      opcion.style.cssText = 'background:rgba(255,255,255,.07);padding:8px 10px;border-radius:6px;margin-bottom:6px;cursor:pointer';
      opcion.addEventListener('mouseenter', function () { opcion.style.background = 'rgba(254,213,68,.25)'; });
      opcion.addEventListener('mouseleave', function () { opcion.style.background = 'rgba(255,255,255,.07)'; });
      opcion.addEventListener('click', function () {
        texto(el, alt);
        if (typeof window.calcBudget === 'function') window.calcBudget();
        cerrarPopover();
        el.focus();
      });
      caja.appendChild(opcion);
    });

    var pie = document.createElement('div');
    pie.style.cssText = 'display:flex;gap:8px;margin-top:4px';
    var volver = document.createElement('button');
    volver.textContent = 'Dejar el texto como estaba';
    volver.style.cssText = 'background:none;border:1px solid rgba(255,255,255,.25);color:#fff;border-radius:5px;padding:4px 10px;font-size:10px;cursor:pointer;font-family:inherit';
    volver.addEventListener('click', function () { texto(el, original); cerrarPopover(); });
    var cerrar = document.createElement('button');
    cerrar.textContent = 'Cerrar';
    cerrar.style.cssText = volver.style.cssText;
    cerrar.addEventListener('click', cerrarPopover);
    pie.appendChild(volver);
    pie.appendChild(cerrar);
    caja.appendChild(pie);

    popover(boton, caja);
  }

  function crearBoton(el) {
    var boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'ai-wand';
    boton.title = 'Sugerir redacción con IA';
    boton.textContent = '✨';
    boton.style.cssText = 'background:none;border:none;cursor:pointer;font-size:11px;opacity:.35;padding:0 4px;' +
      'line-height:1;vertical-align:middle';
    boton.addEventListener('mouseenter', function () { boton.style.opacity = '1'; });
    boton.addEventListener('mouseleave', function () { boton.style.opacity = '.35'; });

    boton.addEventListener('click', async function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var bloque = el.getAttribute('data-ai-wand') || 'libre';
      boton.textContent = '⏳';
      try {
        var alternativas = await pedirAlternativas(bloque, texto(el));
        mostrarAlternativas(boton, el, alternativas);
      } catch (e) {
        var aviso = document.createElement('div');
        aviso.textContent = 'No se han podido pedir sugerencias: ' + e.message;
        popover(boton, aviso);
      } finally {
        boton.textContent = '✨';
      }
    });
    return boton;
  }

  function montar() {
    var bloques = document.querySelectorAll('[data-ai-wand]');
    Array.prototype.forEach.call(bloques, function (el) {
      if (el.dataset.aiWandListo) return;
      el.dataset.aiWandListo = '1';
      var boton = crearBoton(el);
      // El botón va fuera del bloque editable: si estuviera dentro, acabaría
      // dentro del texto al escribir o al copiar y pegar.
      if (el.nextSibling) el.parentNode.insertBefore(boton, el.nextSibling);
      else el.parentNode.appendChild(boton);
    });
  }

  document.addEventListener('click', function (e) {
    var pop = document.getElementById('aiWandPop');
    if (pop && !pop.contains(e.target) && !(e.target.classList && e.target.classList.contains('ai-wand'))) cerrarPopover();
  });

  // Al imprimir no debe salir ni la varita ni el desplegable.
  var estilo = document.createElement('style');
  estilo.textContent = '@media print{.ai-wand,#aiWandPop{display:none !important}}';
  document.head.appendChild(estilo);

  window.montarVaritasIA = montar;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
