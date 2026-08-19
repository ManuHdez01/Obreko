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
    var v = Math.round(Number(n) || 0);
    return String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.').replace(/^/, v < 0 ? '-' : '');
  }

  // Precio unitario, importe, material y mano de obra POR PARTIDA sí llevan
  // céntimos (vienen así desde la herramienta de presupuestos) — solo el
  // subtotal de capítulo y los totales agregados se redondean a entero con
  // fmtMoney. Sin decimales de sobra si no los tiene (450, no 450,00).
  function fmtMoneyDecimal(n) {
    var v = Math.round((Number(n) || 0) * 100) / 100;
    var partes = Math.abs(v).toFixed(2).split('.');
    var entera = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    var texto = partes[1] === '00' ? entera : entera + ',' + partes[1];
    return (v < 0 ? '-' : '') + texto;
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
      // Presupuesto simple: celdas material/mano de obra marcadas con
      // data-type. Presupuesto detallado (ver esFormatoDetallado más abajo):
      // no llevan data-type, se identifican por su columna de código.
      return tr.querySelector('[data-type="mat"]') || tr.querySelector('[data-type="labor"]') || tr.querySelector('td.codigo');
    });
  }

  // Agrupa las partidas por capítulo (el campo "concept" de cada fila),
  // conservando el orden en que aparecen la primera vez — es el mismo orden
  // del presupuesto de origen.
  function agruparPorCapitulo(filas) {
    var grupos = [];
    var indice = {};
    filas.forEach(function (f) {
      var clave = f.concept || 'Otros trabajos';
      if (!(clave in indice)) {
        indice[clave] = grupos.length;
        grupos.push({ capitulo: clave, items: [] });
      }
      grupos[indice[clave]].items.push(f);
    });
    return grupos;
  }

  // Reconstruye el cuerpo del presupuesto agrupado por capítulo: una fila de
  // cabecera (el capítulo, en negro, UNA sola vez) seguida de sus partidas.
  // Las filas de subtotal/impuesto/total viven dentro del mismo <tbody> que
  // las partidas (no en uno aparte), así que se apartan antes de vaciar la
  // tabla y se vuelven a insertar al final, para que las partidas nuevas
  // caigan siempre por delante de los totales y nunca detrás.
  function volcarPresupuesto(tbody, filas) {
    if (!tbody || !filas || !filas.length) return;

    // Filas de totales que nunca se tocan: las de siempre (rowSubMat/rowIva/
    // .p7-total-row, para las plantillas con el pie simple de 3 filas) más
    // cualquier fila marcada .p7-footer-row (el pie ampliado del presupuesto
    // detallado, con 5 filas: ejecución material, beneficio industrial,
    // contrata, impuesto y total). Sin esto último, las dos filas nuevas se
    // borrarían en cada importación por no estar en la lista.
    var especiales = [];
    var vistas = [];
    function marcarEspecial(el) {
      if (el && el.parentNode === tbody && vistas.indexOf(el) === -1) { vistas.push(el); especiales.push(el); }
    }
    ['rowSubMat', 'rowIva'].forEach(function (id) { marcarEspecial(document.getElementById(id)); });
    marcarEspecial(tbody.querySelector('.p7-total-row'));
    Array.prototype.forEach.call(tbody.querySelectorAll('.p7-footer-row'), marcarEspecial);
    // especiales[0] marca dónde se insertan las partidas nuevas: tiene que
    // ser la primera fila de totales en el documento, no la primera que se
    // haya detectado (el orden de detección de arriba no es el orden real).
    especiales.sort(function (a, b) {
      return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
    });
    var referencia = especiales[0] || null;

    var plantilla = dataRows(tbody)[0];
    if (!plantilla) return;
    // Presupuesto detallado: la misma estructura que la pestaña del Excel de
    // origen (código, ud, cantidad, precio, notas, material, mano de obra).
    // Se detecta por la propia plantilla, así este script sigue sirviendo
    // sin cambios a las otras plantillas que solo llevan Concepto + Importe.
    var esFormatoDetallado = !!plantilla.querySelector('td.codigo');
    var columnasReales = plantilla.children.length - 1; // menos el botón de borrar
    plantilla = plantilla.cloneNode(true);

    // Vacía el cuerpo de datos (partidas + posibles cabeceras de una
    // importación anterior), dejando intactas las filas de totales.
    Array.prototype.slice.call(tbody.querySelectorAll('tr')).forEach(function (tr) {
      if (especiales.indexOf(tr) === -1) tr.remove();
    });

    agruparPorCapitulo(filas).forEach(function (grupo, gi) {
      var cab = document.createElement('tr');
      cab.className = 'cat-row';
      var celda = document.createElement('td');
      celda.colSpan = columnasReales;
      celda.textContent = grupo.capitulo;
      cab.appendChild(celda);
      tbody.insertBefore(cab, referencia);

      grupo.items.forEach(function (item, ii) {
        var fila = plantilla.cloneNode(true);
        if (esFormatoDetallado) {
          rellenarFilaDetallada(fila, item, (gi + 1) + '.' + (ii + 1));
        } else {
          setCell(conceptCell(fila), item.desc || '');
          var mat = fila.querySelector('[data-type="mat"]');
          setCell(mat, item.mat > 0 ? fmtMoney(item.mat) : '—');
          var labor = fila.querySelector('[data-type="labor"]');
          if (labor) setCell(labor, '—');
          if (mat) mat.addEventListener('input', function () {
            if (typeof window.calcBudget === 'function') window.calcBudget();
          });
        }
        tbody.insertBefore(fila, referencia);
      });

      if (esFormatoDetallado) {
        tbody.insertBefore(crearFilaSubtotalCapitulo(grupo, gi + 1), referencia);
      }
    });

    renumerarDatos(tbody);
    evitarSolapeEnPaginaLarga(tbody);
  }

  // Redondea a 2 decimales como mucho y usa coma española; sin decimales de
  // sobra para cantidades enteras (1, no 1,00).
  function formatearCantidad(n) {
    var v = Number(n) || 0;
    if (!v) return '—';
    var redondeado = Math.round(v * 100) / 100;
    return (redondeado % 1 === 0 ? String(redondeado) : redondeado.toFixed(2)).replace('.', ',');
  }

  // Rellena una fila del presupuesto detallado (código, descripción, ud,
  // cantidad, precio, importe, notas, material, mano de obra, total) — la
  // misma estructura que la pestaña "Presupuesto Detallado" del Excel.
  function rellenarFilaDetallada(fila, item, codigo) {
    setCell(fila.querySelector('td.codigo'), codigo);
    setCell(fila.querySelector('td.concept'), item.desc || '');
    setCell(fila.querySelector('td.ud'), item.ud || 'ud');
    setCell(fila.querySelector('td.cantidad'), formatearCantidad(item.cantidad));
    setCell(fila.querySelector('td.precio'), item.precioUnit > 0 ? fmtMoneyDecimal(item.precioUnit) : '—');
    setCell(fila.querySelector('td.importe'), item.importe > 0 ? fmtMoneyDecimal(item.importe) : '—');
    setCell(fila.querySelector('td.material-col'), item.material > 0 ? fmtMoneyDecimal(item.material) : '—');
    setCell(fila.querySelector('td.manoobra-col'), item.manoObra > 0 ? fmtMoneyDecimal(item.manoObra) : '—');
    var total = fila.querySelector('td.total-col');
    setCell(total, item.importe > 0 ? fmtMoneyDecimal(item.importe) : '—');
    if (total) total.addEventListener('input', function () {
      if (typeof window.calcBudget === 'function') window.calcBudget();
    });
  }

  // Fila "Subtotal Capítulo N" tras las partidas de cada capítulo: solo
  // material, mano de obra y total de ese capítulo, cada uno bajo su
  // columna correspondiente (Importe no lleva subtotal propio, coincide
  // con el Total).
  function crearFilaSubtotalCapitulo(grupo, numeroCapitulo) {
    var sumaImporte = 0, sumaMaterial = 0, sumaManoObra = 0;
    grupo.items.forEach(function (it) {
      sumaImporte += Number(it.importe) || 0;
      sumaMaterial += Number(it.material) || 0;
      sumaManoObra += Number(it.manoObra) || 0;
    });
    var tr = document.createElement('tr');
    tr.className = 'subtotal-row';
    var label = document.createElement('td');
    label.className = 'subtotal-label';
    label.colSpan = 6; // Código + Descripción + Ud + Cantidad + Precio Unit. + Importe
    label.textContent = 'Subtotal Capítulo ' + numeroCapitulo;
    tr.appendChild(label);
    [fmtMoney(sumaMaterial), fmtMoney(sumaManoObra), fmtMoney(sumaImporte)].forEach(function (texto) {
      var td = document.createElement('td');
      td.textContent = texto;
      tr.appendChild(td);
    });
    tr.appendChild(document.createElement('td')); // hueco bajo la columna de borrar
    return tr;
  }

  // Un presupuesto con muchos capítulos (cada uno añade su propia fila de
  // cabecera) puede hacer que la tabla no quepa en una hoja A4: al imprimir,
  // el CSS de impresión (ver reformas.html, .p7-page) deja que la página
  // fluya a tantas hojas físicas como haga falta, repitiendo la cabecera de
  // columnas. Pero el pie ("obreko" + nº de página) y el aviso de precios
  // orientativos están clavados al fondo (position:absolute, calculado para
  // una página de una sola hoja), así que en una página que ha crecido
  // acaban solapados sobre el propio aviso en vez de ir debajo de la última
  // fila. Si la página se pasa de una hoja, se sueltan a flujo normal para
  // que caigan justo después de la tabla, no encima.
  function evitarSolapeEnPaginaLarga(tbody) {
    var pagina = tbody.closest('.page');
    if (!pagina) return;
    var ALTURA_HOJA_PX = 1130; // 297mm a 96dpi + un margen pequeño
    if (pagina.scrollHeight <= ALTURA_HOJA_PX) return;

    var nota = pagina.querySelector('.p7-note');
    if (nota) { nota.style.position = 'static'; nota.style.marginTop = '4mm'; }

    var footer = pagina.querySelector('.page-footer');
    if (footer) { footer.style.position = 'static'; footer.style.marginTop = '6mm'; footer.style.borderTop = '1px solid rgba(26,34,54,.08)'; }

    // El número de página lo añade _page-numbers.js al cargar la hoja, antes
    // de que se importe el presupuesto: su posición se calculó para la
    // tabla de ejemplo, corta, así que también hay que soltarlo aquí.
    var badge = pagina.querySelector('.page-number-badge');
    if (badge) { badge.style.position = 'static'; badge.style.display = 'block'; badge.style.textAlign = 'center'; badge.style.marginTop = '2mm'; }
  }

  // Los números de fila se asignan al final y solo a filas de datos: las
  // cabeceras de capítulo no cuentan.
  function renumerarDatos(tbody) {
    var n = 1;
    Array.prototype.forEach.call(tbody.querySelectorAll('tr'), function (tr) {
      if (tr.classList.contains('cat-row')) return;
      var num = tr.querySelector('td.num');
      if (num) { num.textContent = String(n); n++; }
    });
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

    volcarPresupuesto(tbody, payload.rows);

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
    volcarPlanos(payload.imagenes);

    // Contexto de la obra para la varita de redacción: sobrevive al borrado
    // del payload de importación.
    try {
      localStorage.setItem('obreko_proposal_ctx', JSON.stringify({
        tipo: payload.tipo || '', m2: payload.m2 || 0, address: payload.address || '',
        region: payload.region || 'tenerife', clientName: payload.clientName || '',
        capitulos: (payload.rows || []).map(function (r) { return r.concept; })
          .filter(function (d, idx, arr) { return d && arr.indexOf(d) === idx; }).slice(0, 20),
      }));
    } catch (e) {}

    aplicarTextos(payload.textos);

    if (typeof window.calcBudget === 'function') window.calcBudget();
    // Los bloques recién creados también tienen que llevar su varita.
    if (typeof window.montarVaritasIA === 'function') window.montarVaritasIA();

    // Resumen de lo rellenado: si algo no ha entrado, se ve en el acto en vez
    // de tener que ir página por página buscándolo.
    var hechos = [payload.rows.length + ' partidas'];
    if (Array.isArray(payload.imagenes) && payload.imagenes.length) hechos.push(payload.imagenes.length + ' planos/fotos');
    if (clientEl && payload.clientName) hechos.push('portada');
    if (document.querySelector('.p4-field-val') && payload.address) hechos.push('ficha técnica');
    if (payload.textos) {
      var t = payload.textos;
      if (t.objetivo || t.intro) hechos.push('textos');
      if (Array.isArray(t.trabajos) && t.trabajos.length) hechos.push(t.trabajos.length + ' trabajos');
      if (Array.isArray(t.condiciones) && t.condiciones.length) hechos.push(t.condiciones.length + ' condiciones');
      if (Array.isArray(t.calendario) && t.calendario.length) hechos.push('calendario de ' + t.calendario.length + ' fases');
    }
    window.__ultimoImport = hechos;
    return true;
  }

  // Calendario de obra: la IA propone las fases y sus semanas, y se pintan en
  // el diagrama. Sigue siendo editable: se puede cambiar el nombre de la fase
  // y pintar o despintar cualquier celda a mano.
  function volcarCalendario(fases) {
    var tabla = document.getElementById('ganttTable');
    if (!tabla || !Array.isArray(fases) || !fases.length) return;
    var tbody = tabla.querySelector('tbody');
    if (!tbody) return;

    while (tbody.querySelectorAll('tr').length < fases.length && typeof window.addGanttRow === 'function') {
      var antes = tbody.querySelectorAll('tr').length;
      window.addGanttRow();
      if (tbody.querySelectorAll('tr').length === antes) break;
    }
    var filas = tbody.querySelectorAll('tr');

    filas.forEach(function (tr, idx) {
      var nombre = tr.querySelector('.task-name');
      var celdas = tr.querySelectorAll('.gcell');
      var fase = fases[idx];
      if (!fase) {
        // Fase que no usa la IA: se vacía en vez de dejar el ejemplo puesto.
        if (nombre) nombre.textContent = '';
        celdas.forEach(function (c) { c.style.background = ''; delete c.dataset.color; });
        return;
      }
      if (nombre) nombre.textContent = fase.tarea;
      celdas.forEach(function (c, semana) {
        var dentro = (semana + 1) >= fase.desde && (semana + 1) <= fase.hasta;
        c.style.background = dentro ? '#5C7CD9' : '';
        if (dentro) c.dataset.color = '#5C7CD9'; else delete c.dataset.color;
      });
    });
  }

  // Documentación gráfica: las fotos y planos del proyecto entran en las cajas
  // de la página de planos. Si hay más imágenes que cajas, se crean con el
  // mismo botón que usarías a mano.
  function volcarPlanos(claves) {
    if (!Array.isArray(claves) || !claves.length) return;
    var cajas = document.querySelectorAll('.p5-plan-box, .plan-box');
    if (!cajas.length) return;

    var botonAnadir = document.querySelector('.plan-add-btn');
    while (cajas.length < claves.length && botonAnadir && typeof window.addPlanBox === 'function') {
      var antes = cajas.length;
      window.addPlanBox(botonAnadir);
      cajas = document.querySelectorAll('.p5-plan-box, .plan-box');
      if (cajas.length === antes) break; // por si el botón no crea nada
    }

    claves.forEach(function (clave, idx) {
      var caja = cajas[idx];
      if (!caja) return;
      var url = '/api/budget-tool/imagen?key=' + encodeURIComponent(clave);
      caja.style.backgroundImage = 'url("' + url + '")';
      caja.classList.add('has-image');
      var pista = caja.querySelector('.p5-plan-hint, .plan-hint');
      if (pista) pista.textContent = '';
    });
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
      // Sale del análisis de plano/foto de la herramienta interna (estado
      // aparente, trabajos sugeridos, notas). Sigue siendo editable aquí.
      'observaciones': payload.observaciones || '',
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

    volcarCalendario(textos.calendario);

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
        bar.children[1].innerHTML = 'Importado ✓ ' + (window.__ultimoImport || []).join(' · ') +
          ' — revisa el documento y guarda como PDF o en el CRM.';
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

    // Cubre también el caso de un presupuesto que ha crecido a mano (botón
    // "+ Añadir partida") sin pasar nunca por la importación: se revisa otra
    // vez justo antes de imprimir, no solo en el momento de importar.
    var tbody = document.getElementById('budgetBody');
    if (tbody) {
      window.addEventListener('beforeprint', function () { evitarSolapeEnPaginaLarga(tbody); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
