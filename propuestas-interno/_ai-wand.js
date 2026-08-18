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

  // Clases que siempre llevan varita aunque el texto sea corto o esté vacío:
  // son campos de redacción (observaciones, notas, etiquetas de plano...).
  var SIEMPRE = ['p4-field-val', 'sand-note', 'p6-trabajo-text', 'p5-plan-label',
    'p9-card-desc', 'p3-card-desc', 'p11-subtext', 'task-name'];

  function tipoDeBloque(el) {
    if (el.getAttribute('data-ai-wand')) return el.getAttribute('data-ai-wand');
    if (el.classList.contains('p6-trabajo-text')) return 'trabajo';
    if (el.classList.contains('task-name')) return 'trabajo';
    if (el.closest('#condicionesExtra') || el.closest('.p7-cond, .conditions')) return 'condicion';
    return 'libre';
  }

  // Un bloque merece varita si es un campo de redacción o si ya tiene un texto
  // de cierta longitud. Los números del presupuesto y las etiquetas cortas se
  // quedan fuera: ahí una varita solo estorba.
  function mereceVarita(el) {
    if (el.closest('#budgetTable') || el.closest('.p1-meta')) return false;
    if (el.getAttribute('data-ai-wand')) return true;
    for (var i = 0; i < SIEMPRE.length; i++) if (el.classList.contains(SIEMPRE[i])) return true;
    return (el.textContent || '').trim().length >= 60;
  }

  function montar() {
    var candidatos = document.querySelectorAll('[contenteditable="true"], [data-ai-wand]');
    Array.prototype.forEach.call(candidatos, function (el) {
      if (el.dataset.aiWandListo || !mereceVarita(el)) return;
      if (!el.getAttribute('data-ai-wand')) el.setAttribute('data-ai-wand', tipoDeBloque(el));
    });
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
    montarBotonesDePagina();
  }

  // ── Rellenar toda la hoja de un tirón ──────────────────────────────────
  // Un botón por página que, tras una única confirmación, pide una
  // redacción para cada bloque de esa hoja y las aplica todas. Sigue
  // siendo reversible: guarda el texto anterior de cada bloque y ofrece
  // deshacerlo todo con un clic durante unos segundos.

  function avisoFlotante(html) {
    var previo = document.getElementById('aiPageToast');
    if (previo) previo.remove();
    var aviso = document.createElement('div');
    aviso.id = 'aiPageToast';
    aviso.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:100000;' +
      'background:#1A2236;color:#fff;padding:10px 16px;border-radius:8px;font-family:"DM Sans",Arial,sans-serif;' +
      'font-size:12px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 24px rgba(0,0,0,.35);';
    aviso.innerHTML = html;
    document.body.appendChild(aviso);
    return aviso;
  }

  function crearBotonDePagina(pagina) {
    var boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'ai-wand ai-wand-page';
    boton.title = 'Rellenar con IA todos los apartados de esta hoja';
    boton.textContent = '✨ Rellenar hoja';
    boton.style.cssText = 'position:absolute;top:3mm;right:3mm;z-index:70;background:#1A2236;color:#FED544;' +
      'border:none;border-radius:20px;padding:4px 11px;font-family:"DM Sans",Arial,sans-serif;font-size:7.5pt;' +
      'font-weight:600;letter-spacing:.04em;cursor:pointer;opacity:.4;box-shadow:0 2px 8px rgba(0,0,0,.2);';
    boton.addEventListener('mouseenter', function () { boton.style.opacity = '1'; });
    boton.addEventListener('mouseleave', function () { boton.style.opacity = '.4'; });

    boton.addEventListener('click', async function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var bloques = Array.prototype.filter.call(
        pagina.querySelectorAll('[data-ai-wand]'),
        function (el) { return el.offsetParent !== null; } // solo lo visible en esta hoja ahora mismo
      );
      if (!bloques.length) { avisoFlotante('Esta hoja no tiene apartados que redactar con IA.'); setTimeout(cerrarAviso, 2500); return; }
      var ok = confirm('¿Rellenar con IA los ' + bloques.length + ' apartados de esta hoja? Se sustituye el texto actual en todos (podrás deshacerlo después).');
      if (!ok) return;

      var textoOriginal = boton.textContent;
      boton.disabled = true;
      var hechos = 0;
      boton.textContent = '⏳ 0/' + bloques.length;

      var anteriores = bloques.map(function (el) { return { el: el, texto: texto(el) }; });

      var resultados = await Promise.all(bloques.map(function (el) {
        var tipo = el.getAttribute('data-ai-wand') || 'libre';
        return pedirAlternativas(tipo, texto(el))
          .then(function (alts) { hechos++; boton.textContent = '⏳ ' + hechos + '/' + bloques.length; return alts; })
          .catch(function () { hechos++; boton.textContent = '⏳ ' + hechos + '/' + bloques.length; return null; });
      }));

      var fallidos = 0;
      resultados.forEach(function (alts, i) {
        if (!alts || !alts.length) { fallidos++; return; }
        // Se usa la alternativa "más detallada" (la 2ª) cuando existe; si no,
        // la única disponible.
        var elegida = alts.length > 1 ? alts[1] : alts[0];
        texto(bloques[i], elegida);
      });

      boton.disabled = false;
      boton.textContent = textoOriginal;

      var mensaje = (bloques.length - fallidos) + ' de ' + bloques.length + ' apartados rellenados';
      if (fallidos) mensaje += ' (' + fallidos + ' sin poder redactar)';
      var aviso = avisoFlotante(
        '<span>' + mensaje + '</span>' +
        '<button id="aiPageUndo" style="background:#FED544;color:#1A2236;border:none;border-radius:5px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Deshacer</button>' +
        '<button id="aiPageOk" style="background:none;border:1px solid rgba(255,255,255,.3);color:#fff;border-radius:5px;padding:4px 10px;font-size:11px;cursor:pointer;font-family:inherit">Vale</button>'
      );
      var quitar = document.getElementById('aiPageOk');
      var deshacer = document.getElementById('aiPageUndo');
      if (quitar) quitar.addEventListener('click', cerrarAviso);
      if (deshacer) deshacer.addEventListener('click', function () {
        anteriores.forEach(function (a) { texto(a.el, a.texto); });
        cerrarAviso();
      });
      setTimeout(cerrarAviso, 12000);
    });

    pagina.appendChild(boton);
  }

  function cerrarAviso() {
    var el = document.getElementById('aiPageToast');
    if (el) el.remove();
  }

  function montarBotonesDePagina() {
    Array.prototype.forEach.call(document.querySelectorAll('.page'), function (pagina) {
      if (pagina.dataset.aiPageListo) return;
      pagina.dataset.aiPageListo = '1';
      crearBotonDePagina(pagina);
    });
  }

  document.addEventListener('click', function (e) {
    var pop = document.getElementById('aiWandPop');
    if (pop && !pop.contains(e.target) && !(e.target.classList && e.target.classList.contains('ai-wand'))) cerrarPopover();
  });

  // Al imprimir no debe salir ni la varita ni el desplegable.
  var estilo = document.createElement('style');
  estilo.textContent = '@media print{.ai-wand,#aiWandPop,#aiPageToast{display:none !important}}';
  document.head.appendChild(estilo);

  window.montarVaritasIA = montar;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
