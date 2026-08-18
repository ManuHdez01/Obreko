// Lógica de proyecto.html — ficha completa de proyecto.
const { $, escapeHtml, fmtMoney, fmtPct, toast, api } = window.BT;

let project = null;
let economics = null;
let costsConfig = null;
let suppliers = [];
let pendingKind = 'plano';
let lastSearchResults = []; // extraCatalog para recommend

const projectId = new URL(location.href).searchParams.get('id');

// ── Carga inicial ────────────────────────────────────────────────────────

async function load() {
  if (!projectId) {
    $('projTitle').textContent = 'Proyecto no indicado';
    toast('Falta ?id= en la URL', 'error');
    return;
  }
  try {
    const [projData, cfg, sup] = await Promise.all([
      api('projects?id=' + encodeURIComponent(projectId)),
      api('costs-config'),
      api('suppliers'),
    ]);
    project = projData.project;
    economics = projData.economics;
    costsConfig = cfg;
    suppliers = sup.suppliers || [];
    renderAll();
  } catch (e) {
    toast('Error cargando: ' + e.message, 'error');
  }
}

function renderAll() {
  $('topRef').textContent = 'PROYECTO · ' + (project.ref || project.id);
  $('projTitle').innerHTML = escapeHtml(project.clientName || 'Proyecto') + ' <em>' + escapeHtml(project.ref || '') + '</em>';
  const statusTxt = project.status === 'ganado' ? ' · 🏆 Ganado' : project.status === 'perdido' ? ' · Perdido' : '';
  // El tipo y la plaza se guardan en minúscula ("reforma integral", "tenerife")
  // porque son valores de un desplegable, pero en la cabecera se leen como
  // texto: van con inicial mayúscula y los metros con coma decimal.
  const subtitulo = [
    conInicialMayuscula(project.tipo),
    project.m2 ? String(project.m2).replace('.', ',') + ' m²' : '',
    conInicialMayuscula(project.region),
  ].filter(Boolean).join(' · ');
  $('projSub').textContent = subtitulo + statusTxt;
  const ganadoBtn = $('ganadoBtn');
  if (ganadoBtn) {
    if (project.status === 'ganado') {
      ganadoBtn.textContent = '🏆 Ganado';
      ganadoBtn.disabled = true;
    } else {
      ganadoBtn.textContent = '🏆 Marcar como Ganado';
      ganadoBtn.disabled = false;
    }
  }

  // Datos
  const map = {
    fClientName: 'clientName', fClientEmail: 'clientEmail', fClientPhone: 'clientPhone',
    fAddress: 'address', fRef: 'ref', fRegion: 'region', fMode: 'mode', fTipo: 'tipo',
    fM2: 'm2', fCalidad: 'calidad',
    fLaborHours: 'laborHours', fLaborRate: 'laborRate', fIndirectPct: 'indirectPct', fMarginPct: 'marginPct',
  };
  for (const [el, key] of Object.entries(map)) $(el).value = project[key] != null ? project[key] : '';
  // Pie del presupuesto: si el proyecto no trae impuesto, se pone el de su
  // plaza (IGIC 7% en Canarias, IVA 21% en península).
  const canarias = (project.region || 'tenerife') === 'tenerife';
  $('fGiPct').value = project.giPct != null && project.giPct !== '' ? project.giPct : 10;
  $('fTaxLabel').value = project.taxLabel || (canarias ? 'IGIC' : 'IVA');
  $('fTaxPctPie').value = project.taxPct ? project.taxPct : (canarias ? 7 : 21);

  const est = project.estancias || {};
  $('fCocinas').value = est.cocinas != null ? est.cocinas : 1;
  $('fBanos').value = est.banos != null ? est.banos : 1;
  $('fDormitorios').value = est.dormitorios != null ? est.dormitorios : 2;

  renderAnalysis();
  renderItems();
  renderEconomics();
  renderSupplierSelect();
  renderRfqSection();
  renderInvoices();
}

function conInicialMayuscula(texto) {
  const t = String(texto || '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

// ── Guardado ─────────────────────────────────────────────────────────────

function collectForm() {
  return {
    id: project.id,
    clientName: $('fClientName').value.trim(),
    clientEmail: $('fClientEmail').value.trim(),
    clientPhone: $('fClientPhone').value.trim(),
    address: $('fAddress').value.trim(),
    ref: $('fRef').value.trim(),
    region: $('fRegion').value,
    mode: $('fMode').value,
    tipo: $('fTipo').value,
    m2: Number($('fM2').value) || 0,
    calidad: $('fCalidad').value,
    estancias: {
      cocinas: Number($('fCocinas').value) || 0,
      banos: Number($('fBanos').value) || 0,
      dormitorios: Number($('fDormitorios').value) || 0,
    },
    laborHours: Number($('fLaborHours').value) || 0,
    laborRate: Number($('fLaborRate').value) || 0,
    indirectPct: Number($('fIndirectPct').value) || 0,
    marginPct: Number($('fMarginPct').value) || 0,
    taxPct: Number($('fTaxPctPie').value) || 0,
    taxLabel: $('fTaxLabel').value || 'IGIC',
    giPct: Number($('fGiPct').value) || 0,
    items: project.items || [],
    rfqs: project.rfqs || [],
    invoices: project.invoices || [],
    analysis: project.analysis || null,
    status: project.status || 'borrador',
  };
}

// Marca el proyecto como Ganado: guarda y, en el servidor, esto vuelca sus
// partidas a la memoria de precios (una única vez, ver price-memory.js).
function marcarGanado() {
  if (!project || project.status === 'ganado') return;
  if (!confirm('¿Marcar este proyecto como Ganado?\n\nSus partidas y precios se guardarán en la memoria de precios de obreko para futuras recomendaciones. Esta acción no se puede deshacer.')) return;
  project.status = 'ganado';
  saveProject(true);
}
window.marcarGanado = marcarGanado;

// Los guardados se serializan: cada save espera al anterior y captura el
// estado del formulario en el momento de ejecutarse. Evita que la respuesta
// de un guardado antiguo pise cambios más recientes (carrera al editar
// varias celdas seguidas).
let saveChain = Promise.resolve();
function saveProject(showToast) {
  saveChain = saveChain.then(async () => {
    try {
      const data = await api('projects', { method: 'POST', body: collectForm() });
      project = data.project;
      economics = data.economics;
      renderEconomics();
      renderItems();
      renderRfqSection();
      renderInvoices();
      if (showToast) toast('Proyecto guardado ✓', 'success');
    } catch (e) {
      toast('Error guardando: ' + e.message, 'error');
    }
  });
  return saveChain;
}
window.saveProject = saveProject;

// ── Pestañas ─────────────────────────────────────────────────────────────

function showTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('on', p.id === 'tab-' + name));
}
window.showTab = showTab;

// ── Análisis (plano/foto) ────────────────────────────────────────────────

function pickFile(kind) {
  pendingKind = kind;
  $('fileInput').click();
}
window.pickFile = pickFile;

const MAX_ANALYZE_FILES = 6;

$('fileInput').addEventListener('change', async (e) => {
  let fileList = Array.from(e.target.files || []);
  e.target.value = '';
  if (!fileList.length) return;
  if (fileList.length > MAX_ANALYZE_FILES) {
    toast(`Máximo ${MAX_ANALYZE_FILES} archivos por análisis; se usarán los primeros ${MAX_ANALYZE_FILES}.`, 'error');
    fileList = fileList.slice(0, MAX_ANALYZE_FILES);
  }
  const multi = fileList.length > 1;
  $('analysisResult').innerHTML = `<div class="state">${multi ? `Leyendo ${fileList.length} archivos…` : (fileList[0].type === 'application/pdf' ? 'Leyendo PDF…' : 'Comprimiendo imagen…')}</div>`;
  try {
    const files = await Promise.all(fileList.map((file) => (
      file.type === 'application/pdf' ? readFileAsBase64(file) : compressImage(file)
    ).then(({ base64, mediaType }) => ({ mediaType, imageBase64: base64 }))));
    $('analysisResult').innerHTML = '<div class="state">Analizando con IA… (puede tardar unos segundos)</div>';
    const data = await api('analyze', {
      method: 'POST',
      body: { projectId: project.id, kind: pendingKind, files },
    });
    project.analysis = { ...data.analysis, kind: data.kind, imageKeys: data.imageKeys, analyzedAt: new Date().toISOString() };
    renderAnalysis();
    toast('Análisis completado', 'success');
  } catch (err) {
    $('analysisResult').innerHTML = '<div class="state error">Error: ' + escapeHtml(err.message) + '</div>';
  }
});

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1600;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const k = Math.min(MAX / width, MAX / height);
        width = Math.round(width * k);
        height = Math.round(height * k);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ base64: reader.result.split(',')[1], mediaType: file.type });
    reader.onerror = () => reject(new Error('No se pudo leer el PDF'));
    reader.readAsDataURL(file);
  });
}

function renderAnalysis() {
  const a = project.analysis;
  if (!a) { $('analysisResult').innerHTML = '<div class="state">Sin análisis todavía.</div>'; return; }
  const est = a.estancias || {};
  $('analysisResult').innerHTML = `
    <div style="font-size:12.5px;line-height:1.7">
      <div><strong>${a.kind === 'plano' ? '📐 Plano' : '📷 Foto'}</strong> · confianza <span class="badge ${a.confianza === 'alta' ? 'badge-ok' : a.confianza === 'media' ? 'badge-warn' : 'badge-err'}">${escapeHtml(a.confianza || '—')}</span></div>
      <div><span style="color:var(--slate)">Superficie estimada:</span> <strong>${a.m2Estimados ? a.m2Estimados + ' m²' : 'no estimable'}</strong></div>
      <div><span style="color:var(--slate)">Estancias:</span> ${est.cocinas ?? '—'} cocina(s) · ${est.banos ?? '—'} baño(s) · ${est.dormitorios ?? '—'} dormitorio(s)${(est.otras || []).length ? ' · ' + est.otras.map(escapeHtml).join(', ') : ''}</div>
      <div><span style="color:var(--slate)">Estado:</span> ${escapeHtml(a.estadoAparente || '—')}</div>
      ${(a.trabajosSugeridos || []).length ? `<div><span style="color:var(--slate)">Trabajos sugeridos:</span> ${a.trabajosSugeridos.map(escapeHtml).join(' · ')}</div>` : ''}
      ${a.notas ? `<div style="color:var(--slate);font-size:11.5px;margin-top:4px">${escapeHtml(a.notas)}</div>` : ''}
      <button class="btn btn-sm btn-pri" style="margin-top:8px" onclick="applyAnalysis()">Aplicar al proyecto</button>
    </div>`;
}

function applyAnalysis() {
  const a = project.analysis;
  if (!a) return;
  if (a.m2Estimados > 0) $('fM2').value = a.m2Estimados;
  const est = a.estancias || {};
  if (est.cocinas != null) $('fCocinas').value = est.cocinas;
  if (est.banos != null) $('fBanos').value = est.banos;
  if (est.dormitorios != null) $('fDormitorios').value = est.dormitorios;
  saveProject(true);
}
window.applyAnalysis = applyAnalysis;

// ── Búsqueda de precios ──────────────────────────────────────────────────

function renderSupplierSelect() {
  const sel = $('searchSupplier');
  sel.innerHTML = '<option value="">Todos (según región)</option>' +
    suppliers.filter((s) => s.active && s.searchUrl).map((s) =>
      `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} (${escapeHtml(s.region)})</option>`).join('');
}

async function buscarPrecios() {
  const query = $('searchQuery').value.trim();
  if (!query) { toast('Escribe qué buscar', 'error'); return; }
  const btn = $('searchBtn');
  btn.disabled = true; btn.textContent = 'Buscando…';
  $('searchResults').innerHTML = '<div class="state">Consultando proveedores y extrayendo precios con IA…</div>';
  try {
    const data = await api('search-prices', {
      method: 'POST',
      body: { query, supplierId: $('searchSupplier').value || null, region: $('fRegion').value },
    });
    renderSearchResults(data);
  } catch (e) {
    $('searchResults').innerHTML = '<div class="state error">Error: ' + escapeHtml(e.message) + '</div>';
  } finally {
    btn.disabled = false; btn.textContent = 'Buscar';
  }
}
window.buscarPrecios = buscarPrecios;

function renderSearchResults(data) {
  lastSearchResults = [];
  const blocks = (data.results || []).map((r) => {
    if (!r.ok) {
      return `<div class="notice" style="border-left-color:var(--red)"><strong>${escapeHtml(r.supplierName)}:</strong> ${escapeHtml(r.error || 'falló')}</div>`;
    }
    r.items.forEach((it) => lastSearchResults.push({ ...it, supplier: r.supplierName, region: r.region }));
    const rows = r.items.map((it, i) => `
      <tr>
        <td>${it.url ? `<a href="${escapeHtml(it.url)}" target="_blank" rel="noopener" style="color:var(--navy)">${escapeHtml(it.name)}</a>` : escapeHtml(it.name)}</td>
        <td class="r">${fmtMoney(it.price)}${it.unit ? '/' + escapeHtml(it.unit) : ''}</td>
        <td class="r"><button class="btn btn-sm btn-pri" onclick='addItemFromSearch(${JSON.stringify(JSON.stringify({ ...it, supplier: r.supplierName }))})'>+ Añadir</button></td>
      </tr>`).join('');
    return `
      <div style="margin-bottom:10px">
        <div style="font-size:11px;font-weight:700;color:var(--navy);margin-bottom:4px">${escapeHtml(r.supplierName)} <span class="badge badge-muted">${r.items.length}</span>${data.cached ? ' <span class="badge badge-warn">caché 24h</span>' : ''}</div>
        <table class="tbl">${rows || '<tr><td class="tbl-empty">Sin resultados con precio.</td></tr>'}</table>
      </div>`;
  });
  $('searchResults').innerHTML = blocks.join('') || '<div class="state">Sin resultados.</div>';
}

function addItemFromSearch(jsonStr) {
  const it = JSON.parse(jsonStr);
  project.items = project.items || [];
  project.items.push({
    name: it.name, supplier: it.supplier, unit: it.unit || 'ud',
    unitPrice: Number(it.price) || 0, quantity: 1,
    totalPrice: Number(it.price) || 0, reasoning: '', url: it.url || '',
  });
  renderItems();
  saveProject(false);
  toast('Añadido: ' + it.name, 'success');
}
window.addItemFromSearch = addItemFromSearch;

// ── Recomendación IA ─────────────────────────────────────────────────────

async function recomendarIA() {
  const btn = $('recBtn');
  btn.disabled = true; btn.textContent = 'Pensando…';
  try {
    const body = {
      mode: $('fMode').value,
      region: $('fRegion').value,
      tipo: $('fTipo').value,
      m2: Number($('fM2').value) || 0,
      calidad: $('fCalidad').value,
      estancias: {
        cocinas: Number($('fCocinas').value) || 0,
        banos: Number($('fBanos').value) || 0,
        dormitorios: Number($('fDormitorios').value) || 0,
      },
      extraCatalog: lastSearchResults,
    };
    if (!body.m2) throw new Error('Indica los m² del proyecto (pestaña Datos).');
    const rec = await api('recommend', { method: 'POST', body });
    const items = (rec.items || []).map((it) => ({
      name: it.name, supplier: it.supplier, unit: it.unit || 'ud',
      unitPrice: Number(it.unitPrice) || 0, quantity: Number(it.quantity) || 1,
      totalPrice: Number(it.totalPrice) || 0, reasoning: it.reasoning || '',
    }));
    if (!items.length) throw new Error('La IA no devolvió artículos.');
    const replace = !project.items || !project.items.length || confirm('Ya hay ' + project.items.length + ' artículos. ¿Reemplazarlos por la nueva recomendación? (Cancelar = añadir al final)');
    project.items = replace ? items : project.items.concat(items);
    renderItems();
    await saveProject(false);
    toast('Recomendación aplicada (' + items.length + ' artículos)', 'success');
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '✨ Recomendar con IA';
  }
}
window.recomendarIA = recomendarIA;

// ── Tabla de materiales ──────────────────────────────────────────────────

// Agrupa por estancia (Cocina, Baño...) manteniendo el índice real de
// project.items en cada fila, para que los onchange/onclick sigan
// apuntando a la posición correcta dentro del array. "Sin estancia
// asignada" agrupa las partidas sin ese campo (import antiguos, IA, etc.)
// y siempre va al final.
// Selección por posición dentro de project.items. Cualquier cosa que mueva
// las posiciones (borrar, añadir, montar partidas) la vacía antes de repintar,
// para no borrar por error una partida distinta a la marcada.
let seleccionItems = new Set();

function renderItems() {
  const items = project.items || [];
  const body = $('itemsBody');
  seleccionItems = new Set(Array.from(seleccionItems).filter((i) => i < items.length));
  if (!items.length) {
    seleccionItems.clear();
    body.innerHTML = '<tr><td colspan="12" class="tbl-empty">Presupuesto vacío. Sube el Excel, móntalo desde texto o añade partidas a mano.</td></tr>';
    pintarTotales(0, 0, 0, 0);
    $('itemsRealTotalRow').style.display = 'none';
    actualizarBarraSeleccion();
    renderRfqItems();
    return;
  }

  // Si las partidas traen capítulo (los "CAP.1 DEMOLICIONES…" del Excel de
  // presupuesto), se agrupa por capítulo y respetando el orden del Excel. Si
  // no hay capítulos, se sigue agrupando por estancia como hasta ahora.
  const porCapitulo = items.some((it) => (it.capitulo || '').trim());
  const sinGrupo = porCapitulo ? 'Sin capítulo' : 'Sin estancia asignada';
  const groups = new Map();
  items.forEach((it, i) => {
    const key = ((porCapitulo ? it.capitulo : it.estancia) || '').trim() || sinGrupo;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  });
  const keys = Array.from(groups.keys()).sort((a, b) => {
    if (a === sinGrupo) return 1;
    if (b === sinGrupo) return -1;
    // Los capítulos van en el orden en que aparecen en el Excel (el sort de JS
    // es estable, así que devolver 0 conserva ese orden); las estancias, por
    // orden alfabético.
    return porCapitulo ? 0 : a.localeCompare(b, 'es');
  });

  body.innerHTML = keys.map((key) => {
    const idxs = groups.get(key);
    const groupBudget = idxs.reduce((s, i) => s + (Number(items[i].totalPrice) || 0), 0);
    const groupReal = idxs.reduce((s, i) => s + (Number(items[i].realCost) || 0), 0);
    const rows = idxs.map((i) => {
      const it = items[i];
      const dev = it.realCost ? (Number(it.realCost) || 0) - (Number(it.totalPrice) || 0) : null;
      const devColor = dev == null ? 'var(--slate)' : dev > 0 ? 'var(--red)' : 'var(--green)';
      return `
        <tr${seleccionItems.has(i) ? ' style="background:rgba(26,34,54,.04)"' : ''}>
          <td><input type="checkbox" ${seleccionItems.has(i) ? 'checked' : ''} onchange="toggleSeleccionItem(${i}, this.checked)"></td>
          <td style="font-size:11px;color:var(--slate);white-space:nowrap">${escapeHtml(capituloCorto(it.capitulo))}</td>
          <td>
            <input type="text" style="width:100%" list="itemNameSuggestions" title="${escapeHtml(it.name)}" value="${escapeHtml(it.name)}" oninput="onItemNameInput(${i}, this.value)" onchange="onItemNameChange(${i}, this.value)">
            ${it.reasoning ? `<div class="item-why" title="${escapeHtml(it.reasoning)}">${escapeHtml(it.reasoning)}</div>` : ''}
          </td>
          <td>${escapeHtml(it.supplier || '—')}</td>
          <td class="r"><span class="cant-cell"><input class="num" type="number" min="0" step="0.1" value="${it.quantity}" onchange="updItem(${i},'quantity',this.value)"><span class="cant-ud">${escapeHtml(it.unit || 'ud')}</span></span></td>
          <td class="r"><input class="num" type="number" min="0" step="1" value="${it.unitPrice}" onchange="updItem(${i},'unitPrice',this.value)"></td>
          <td class="r"><input class="num" type="number" min="0" step="1" value="${it.material || ''}" placeholder="—"${estiloReparto(it)} onchange="updItem(${i},'material',this.value)"></td>
          <td class="r"><input class="num" type="number" min="0" step="1" value="${it.manoObra || ''}" placeholder="—"${estiloReparto(it)} onchange="updItem(${i},'manoObra',this.value)"></td>
          <td class="r"><strong>${fmtMoney(it.totalPrice)}</strong></td>
          <td class="r"><input class="num" type="number" min="0" step="1" value="${it.realCost || ''}" placeholder="—" onchange="updItem(${i},'realCost',this.value)"></td>
          <td class="r" style="color:${devColor}">${dev == null ? '—' : (dev > 0 ? '+' : '') + fmtMoney(dev)}</td>
          <td class="r" style="white-space:nowrap">
            <button class="btn btn-sm btn-sec" title="Guardar en la biblioteca de partidas" onclick="guardarEnBiblioteca(${i}, this)">★</button>
            <button class="btn btn-sm btn-danger" onclick="delItem(${i})">×</button>
          </td>
        </tr>`;
    }).join('');
    const todoElGrupo = idxs.every((i) => seleccionItems.has(i));
    return `
      <tr style="background:var(--sand-lt)">
        <td><input type="checkbox" ${todoElGrupo ? 'checked' : ''} title="Seleccionar todo el grupo" onchange="toggleSeleccionGrupo([${idxs.join(',')}], this.checked)"></td>
        <td colspan="7" style="font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--blue)">${escapeHtml(key)} <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--slate)">(${idxs.length})</span></td>
        <td class="r" style="font-weight:700">${fmtMoney(groupBudget)}</td>
        <td class="r" style="font-weight:700">${groupReal ? fmtMoney(groupReal) : '—'}</td>
        <td colspan="2"></td>
      </tr>
      ${rows}`;
  }).join('');

  const pem = items.reduce((s, it) => s + (Number(it.totalPrice) || 0), 0);
  const totalMaterial = items.reduce((s, it) => s + (Number(it.material) || 0), 0);
  const totalObra = items.reduce((s, it) => s + (Number(it.manoObra) || 0), 0);
  const realTotal = items.reduce((s, it) => s + (Number(it.realCost) || 0), 0);
  pintarTotales(pem, totalMaterial, totalObra, realTotal);
  $('itemsRealTotal').textContent = fmtMoney(realTotal);
  actualizarBarraSeleccion();
  renderRfqItems();
}

// En la fila basta con el código del capítulo ("CAP.1"): el título completo
// ya va en la cabecera del grupo.
function capituloCorto(capitulo) {
  const texto = String(capitulo || '').trim();
  if (!texto) return '—';
  const m = texto.match(/^CAP(?:[IÍ]TULO)?\.?\s*(\d+)/i);
  return m ? 'CAP.' + m[1] : texto.slice(0, 12);
}

// Pie del presupuesto, con la estructura de un presupuesto de obra:
//   TOTAL EJECUCIÓN MATERIAL (suma de capítulos)
//   + Beneficio industrial y gastos generales (% s/ ejecución material)
//   = TOTAL PRESUPUESTO CONTRATA (sin impuesto)
//   + IGIC o IVA sobre el presupuesto de contrata
//   = TOTAL PRESUPUESTO (impuesto incluido)
// Materiales y mano de obra se suman aparte: son dato interno y no entran en
// el total, que ya sale de las partidas.
// Los repartos que ha estimado la IA se pintan en cursiva y gris, para
// distinguirlos de los que venían separados en el Excel.
function estiloReparto(it) {
  return it.repartoEstimado
    ? ' style="font-style:italic;color:var(--slate)" title="Reparto estimado por la IA — corrígelo si lo sabes"'
    : ' title="Dato interno, no sale al cliente"';
}

function pintarTotales(pem, totalMaterial, totalObra, realTotal) {
  const giPct = Number(($('fGiPct') || {}).value) || 0;
  // Todo en euros enteros, y el total es la suma de lo que se ve: si se
  // redondeara solo al pintar, las líneas no cuadrarían con el total.
  const gi = Math.round(pem * (giPct / 100));
  const contrata = pem + gi;
  const taxPct = Number(($('fTaxPctPie') || {}).value) || 0;
  const impuesto = Math.round(contrata * (taxPct / 100));
  $('itemsPem').textContent = fmtMoney(pem);
  $('itemsGi').textContent = fmtMoney(gi);
  $('itemsContrata').textContent = fmtMoney(contrata);
  $('itemsTaxAmount').textContent = fmtMoney(impuesto);
  $('itemsTaxLabel').textContent = ($('fTaxLabel') || {}).value || 'IGIC';
  $('itemsTotalConIgic').textContent = fmtMoney(contrata + impuesto);
  $('itemsMatTotal').textContent = fmtMoney(totalMaterial);
  $('itemsObraTotal').textContent = fmtMoney(totalObra);
  // Material + mano de obra debería sumar la ejecución material. Si no cuadra
  // es que falta repartir alguna partida, y conviene verlo.
  const sinRepartir = pem - (totalMaterial + totalObra);
  $('itemsRepartoAviso').innerHTML = Math.abs(sinRepartir) > 0.5
    ? ` · <span style="color:var(--red)">sin repartir ${escapeHtml(fmtMoney(sinRepartir))}</span>`
    : '';
  $('itemsRealTotalRow').style.display = realTotal > 0 ? 'block' : 'none';
}

// El impuesto sale de la plaza: IGIC 7% en Canarias, IVA 21% en península.
// Se aplica solo cuando el proyecto no trae porcentaje, o cuando se pulsa
// "Según dirección": si lo has puesto tú a mano, no se toca.
function impuestoSegunDireccion() {
  const canarias = ($('fRegion').value || '') === 'tenerife';
  $('fTaxLabel').value = canarias ? 'IGIC' : 'IVA';
  $('fTaxPctPie').value = canarias ? 7 : 21;
  onImpuestoChange();
  toast('Impuesto: ' + (canarias ? 'IGIC 7% (Canarias)' : 'IVA 21% (península)'), 'success');
}
window.impuestoSegunDireccion = impuestoSegunDireccion;

// El impuesto se elige solo en el pie del presupuesto: en Costes & Margen se
// trabaja siempre sin impuestos.
function onImpuestoChange() {
  renderItems();
  saveProject(false);
}
window.onImpuestoChange = onImpuestoChange;

function onGiPctChange() {
  renderItems();
  saveProject(false);
}
window.onGiPctChange = onGiPctChange;

function updItem(i, field, value) {
  const it = project.items[i];
  if (!it) return;
  // Un reparto corregido a mano deja de ser una estimación de la IA.
  if (field === 'material' || field === 'manoObra') it.repartoEstimado = false;
  if (field === 'name' || field === 'estancia') it[field] = value;
  // Los euros van enteros; la cantidad sí admite decimales (49,16 m²).
  else if (field === 'quantity') it[field] = Number(value) || 0;
  else it[field] = Math.round(Number(value) || 0);
  it.totalPrice = Math.round((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0));
  renderItems();
  saveProject(false);
}
window.updItem = updItem;

function delItem(i) {
  project.items.splice(i, 1);
  seleccionItems.clear(); // las posiciones se han movido
  renderItems();
  saveProject(false);
}
window.delItem = delItem;

// ── Selección múltiple y borrado en bloque ───────────────────────────────

function toggleSeleccionItem(i, marcado) {
  if (marcado) seleccionItems.add(i); else seleccionItems.delete(i);
  renderItems();
}
window.toggleSeleccionItem = toggleSeleccionItem;

function toggleSeleccionGrupo(idxs, marcado) {
  idxs.forEach((i) => { if (marcado) seleccionItems.add(i); else seleccionItems.delete(i); });
  renderItems();
}
window.toggleSeleccionGrupo = toggleSeleccionGrupo;

function toggleSeleccionTodo(marcado) {
  seleccionItems = marcado ? new Set((project.items || []).map((_, i) => i)) : new Set();
  renderItems();
}
window.toggleSeleccionTodo = toggleSeleccionTodo;

function actualizarBarraSeleccion() {
  const n = seleccionItems.size;
  const total = (project.items || []).length;
  const barra = $('itemsBulkBar');
  if (barra) {
    barra.style.display = n ? 'flex' : 'none';
    const txt = $('itemsSelCount');
    if (txt) txt.textContent = n === 1 ? '1 partida seleccionada' : n + ' partidas seleccionadas';
  }
  const maestro = $('selAllItems');
  if (maestro) {
    maestro.checked = total > 0 && n === total;
    maestro.indeterminate = n > 0 && n < total;
  }
}

// Guarda de golpe en la biblioteca de partidas todo lo que esté marcado. Las
// que no tengan nombre o precio se saltan y se cuentan aparte, para que quede
// claro que no ha ido todo.
async function guardarSeleccionadasEnBiblioteca(btn) {
  const idxs = Array.from(seleccionItems).sort((a, b) => a - b);
  if (!idxs.length) return;
  const partidas = idxs.map((i) => project.items[i]).filter(Boolean);
  const validas = partidas.filter((it) => it.name && (Number(it.unitPrice) || 0) > 0);
  const descartadas = partidas.length - validas.length;
  if (!validas.length) { toast('Ninguna de las partidas seleccionadas tiene nombre y precio', 'error'); return; }

  const textoOriginal = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
  let guardadas = 0;
  let fallidas = 0;
  for (const it of validas) {
    try {
      await api('library', {
        method: 'POST',
        body: { name: it.name, supplier: it.supplier || '', unit: it.unit || 'ud', unitPrice: it.unitPrice, mode: $('fMode').value, notes: it.reasoning || '' },
      });
      guardadas++;
    } catch {
      fallidas++;
    }
  }
  if (btn) { btn.disabled = false; btn.textContent = textoOriginal; }

  const avisos = [];
  if (descartadas) avisos.push(descartadas + ' sin nombre o precio');
  if (fallidas) avisos.push(fallidas + ' con error');
  toast(guardadas + (guardadas === 1 ? ' partida guardada' : ' partidas guardadas') + ' en la biblioteca' +
    (avisos.length ? ' (' + avisos.join(', ') + ')' : ''), fallidas ? 'error' : 'success');
}
window.guardarSeleccionadasEnBiblioteca = guardarSeleccionadasEnBiblioteca;

function borrarSeleccionadas() {
  const n = seleccionItems.size;
  if (!n) return;
  if (!confirm(`¿Borrar ${n} ${n === 1 ? 'partida seleccionada' : 'partidas seleccionadas'}? No se puede deshacer.`)) return;
  project.items = (project.items || []).filter((_, i) => !seleccionItems.has(i));
  seleccionItems.clear();
  renderItems();
  saveProject(false);
  toast(n + (n === 1 ? ' partida borrada' : ' partidas borradas'), 'success');
}
window.borrarSeleccionadas = borrarSeleccionadas;

function borrarTodasLasPartidas() {
  const n = (project.items || []).length;
  if (!n) { toast('No hay partidas que borrar', 'error'); return; }
  if (!confirm(`¿Borrar las ${n} partidas del proyecto? No se puede deshacer.`)) return;
  project.items = [];
  seleccionItems.clear();
  renderItems();
  saveProject(false);
  toast('Materiales vaciados (' + n + ' partidas)', 'success');
}
window.borrarTodasLasPartidas = borrarTodasLasPartidas;

function addItemManual() {
  project.items = project.items || [];
  project.items.push({ name: '', capitulo: '', supplier: '', unit: 'ud', unitPrice: 0, quantity: 1, totalPrice: 0, realCost: 0, reasoning: '' });
  renderItems();
}
window.addItemManual = addItemManual;

// ── Autocompletar precio al escribir una partida a mano ──────────────────
// Reutiliza la biblioteca de precios (GET /api/budget-tool/library?q=)
// para sugerir nombre/precio mientras el usuario teclea en la fila.

let itemNameSuggestTimer = null;
const itemSuggestCache = {}; // índice de fila -> Map(nombre en minúsculas -> item de biblioteca)

function onItemNameInput(i, value) {
  clearTimeout(itemNameSuggestTimer);
  const q = value.trim();
  if (q.length < 2) return;
  itemNameSuggestTimer = setTimeout(async () => {
    try {
      const data = await api('library?mode=' + encodeURIComponent(project.mode || 'reforma') + '&q=' + encodeURIComponent(q));
      const items = data.items || [];
      const dl = $('itemNameSuggestions');
      if (dl) dl.innerHTML = items.map((it) => `<option value="${escapeHtml(it.name)}">`).join('');
      itemSuggestCache[i] = new Map(items.map((it) => [it.name.toLowerCase(), it]));
    } catch { /* sin sugerencias si falla, no bloquea la edición manual */ }
  }, 300);
}
window.onItemNameInput = onItemNameInput;

function onItemNameChange(i, value) {
  const it = project.items[i];
  if (!it) return;
  const cache = itemSuggestCache[i];
  const match = cache && cache.get(value.trim().toLowerCase());
  // Solo autorrellena si el precio sigue a 0 — no pisa un precio que el
  // usuario ya haya escrito a mano para esa fila.
  if (match && !it.unitPrice) {
    it.name = value;
    it.supplier = match.supplier || it.supplier;
    it.unit = match.unit || it.unit;
    it.unitPrice = match.unitPrice;
    it.quantity = it.quantity || 1;
    it.totalPrice = it.quantity * it.unitPrice;
    renderItems();
    toast('Precio sugerido de la biblioteca: ' + fmtMoney(match.unitPrice), 'success');
    saveProject(false);
  } else {
    updItem(i, 'name', value);
  }
}
window.onItemNameChange = onItemNameChange;

// ── Costes & margen ──────────────────────────────────────────────────────

function sugerirHoras() {
  const tipo = $('fMode').value === 'amueblar' ? 'amueblar' : $('fTipo').value;
  const hpm2 = Number(costsConfig.hoursPerM2 && costsConfig.hoursPerM2[tipo]) || 0;
  const m2 = Number($('fM2').value) || 0;
  const rates = Object.values(costsConfig.laborRates || {});
  const avg = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  $('fLaborHours').value = (m2 * hpm2).toFixed(1);
  $('fLaborRate').value = avg.toFixed(2);
  if (!Number($('fIndirectPct').value)) $('fIndirectPct').value = costsConfig.indirectPct != null ? costsConfig.indirectPct : 15;
  if (!Number($('fMarginPct').value)) $('fMarginPct').value = costsConfig.defaultMarginPct != null ? costsConfig.defaultMarginPct : 25;
  saveProject(true);
}
window.sugerirHoras = sugerirHoras;

function renderEconomics() {
  const e = economics || {};
  $('ecoSummary').innerHTML = `
    <div class="summary-card"><div class="summary-label">Coste interno</div><div class="summary-value">${fmtMoney(e.internalCost)}</div><div class="summary-extra">mat + MO + indirectos</div></div>
    <div class="summary-card"><div class="summary-label">PVP sugerido</div><div class="summary-value">${fmtMoney(e.suggestedPrice)}</div><div class="summary-extra">margen ${fmtPct(e.marginPct)}</div></div>
    <div class="summary-card"><div class="summary-label">Margen previsto</div><div class="summary-value">${fmtMoney(e.marginAmount)}</div><div class="summary-extra">sobre venta</div></div>
    <div class="summary-card"><div class="summary-label">Facturado</div><div class="summary-value">${fmtMoney(e.invoicedTotal)}</div><div class="summary-extra">cobrado ${fmtMoney(e.collectedTotal)}</div></div>
    <div class="summary-card"><div class="summary-label">Margen real</div><div class="summary-value">${e.realMarginPct == null ? '—' : fmtMoney(e.realMargin)}</div><div class="summary-extra">${e.realMarginPct == null ? 'sin facturas emitidas' : fmtPct(e.realMarginPct)}</div></div>
  `;
  // Venta (lo que presupuestas) frente a coste (lo que llevas pagado). La
  // venta sale del desglose material/mano de obra de cada partida; el coste,
  // de las facturas de proveedor clasificadas y de las horas de la ficha.
  const fila = (concepto, venta, coste, nota) => {
    const margen = venta - coste;
    const color = coste > venta && venta > 0 ? 'var(--red)' : 'var(--slate)';
    return `<tr>
      <td>${concepto}${nota ? `<div style="font-size:10.5px;color:var(--slate)">${nota}</div>` : ''}</td>
      <td class="r">${fmtMoney(venta)}</td>
      <td class="r">${fmtMoney(coste)}</td>
      <td class="r" style="color:${color}">${venta || coste ? fmtMoney(margen) : '—'}</td>
    </tr>`;
  };
  const margenTotal = e.ventaTotal - e.costeTotal;
  // El coste previsto resta sobre el precio de venta: lo que queda es el
  // margen con el que sale el presupuesto tal y como está.
  const margenPrevisto = e.ventaTotal - e.internalCost;
  // El total va dentro de la tabla, con cada cifra bajo su columna y la misma
  // tipografía que el resto de números.
  $('costBreakdown').innerHTML = `
    <table class="tbl eco-tbl">
      <thead><tr><th></th><th class="r">Venta (presupuesto)</th><th class="r">Coste (real)</th><th class="r">Margen</th></tr></thead>
      <tbody>
        ${fila('Materiales', e.ventaMateriales, e.costeMateriales, e.costeFacturasMateriales ? 'facturas de proveedor' : 'sin facturas todavía')}
        ${fila('Mano de obra', e.ventaObra, e.costeObra, e.costeObraManual ? 'incluye ' + fmtMoney(e.costeObraManual) + ' de horas × tarifa' : 'facturas y horas × tarifa')}
        ${fila('Costes indirectos', 0, e.costeIndirecto, 'facturas indirectas y % de la ficha')}
        ${Math.abs(e.costeSinClasificar) >= 1 ? fila('Facturas sin clasificar', 0, e.costeSinClasificar, 'regístralas con su concepto de coste') : ''}
        ${Math.abs(e.ventaSinRepartir) >= 1 ? `<tr><td style="color:var(--red)">Venta sin repartir<div style="font-size:10.5px">partidas sin desglose de material y mano de obra</div></td><td class="r" style="color:var(--red)">${fmtMoney(e.ventaSinRepartir)}</td><td class="r">—</td><td class="r">—</td></tr>` : ''}
      </tbody>
      <tfoot>
        <tr class="eco-total">
          <td>TOTAL</td>
          <td class="r">${fmtMoney(e.ventaTotal)}</td>
          <td class="r">${fmtMoney(e.costeTotal)}</td>
          <td class="r">${fmtMoney(margenTotal)}</td>
        </tr>
      </tfoot>
    </table>
    <div class="totals-row" style="margin-top:10px"><span>Precio de venta (presupuesto, sin impuestos)</span><span class="val">${fmtMoney(e.ventaTotal)}</span></div>
    <div class="totals-row"><span>Coste interno previsto (materiales + horas + indirectos)</span><span class="val" style="color:var(--red)">-${fmtMoney(e.internalCost)}</span></div>
    <div class="totals-row grand"><span>Margen previsto</span><span class="val" style="color:${margenPrevisto < 0 ? 'var(--red)' : 'var(--green)'}">${fmtMoney(margenPrevisto)}${e.ventaTotal ? ' (' + fmtPct((margenPrevisto / e.ventaTotal) * 100) + ')' : ''}</span></div>
    <div class="totals-row" style="margin-top:10px"><span style="color:var(--slate)">Referencia: con el margen objetivo del ${fmtPct(e.marginPct)}, el PVP sería</span><span class="val" style="color:var(--slate)">${fmtMoney(e.suggestedPrice)}</span></div>
  `;
  $('realBreakdown').innerHTML = `
    <div class="totals-row"><span>Presupuestado al cliente (PVP)</span><span class="val">${fmtMoney(e.suggestedPrice)}</span></div>
    <div class="totals-row"><span>Facturado al cliente</span><span class="val">${fmtMoney(e.invoicedTotal)}</span></div>
    <div class="totals-row"><span>Cobrado</span><span class="val">${fmtMoney(e.collectedTotal)}</span></div>
    <div class="totals-row"><span>Coste previsto</span><span class="val">${fmtMoney(e.internalCost)}</span></div>
    <div class="totals-row"><span>Coste real (facturas recibidas)</span><span class="val">${fmtMoney(e.realCost)}</span></div>
    <div class="totals-row grand"><span>Margen real</span><span class="val">${e.realMarginPct == null ? '—' : fmtMoney(e.realMargin) + ' (' + fmtPct(e.realMarginPct) + ')'}</span></div>
  `;

  // Aviso de desviación: solo si ya hay coste real registrado (facturas
  // de proveedor recibidas), para no avisar en falso en un proyecto sin empezar.
  const devEl = $('deviationAlert');
  if (devEl) {
    if (e.internalCost > 0 && e.realCost > 0) {
      const ratio = e.realCost / e.internalCost;
      if (ratio >= 1) {
        devEl.innerHTML = `<div class="notice" style="border-left-color:var(--red);margin-bottom:10px">⚠️ El coste real (${fmtMoney(e.realCost)}) ha superado el coste previsto (${fmtMoney(e.internalCost)}) — ${fmtPct((ratio - 1) * 100)} por encima.</div>`;
      } else if (ratio >= 0.9) {
        devEl.innerHTML = `<div class="notice" style="border-left-color:#b8860b;margin-bottom:10px">El coste real está al ${fmtPct(ratio * 100)} del previsto — queda poco margen de desviación.</div>`;
      } else {
        devEl.innerHTML = '';
      }
    } else {
      devEl.innerHTML = '';
    }
  }
}

// ── RFQ ──────────────────────────────────────────────────────────────────

function renderRfqSection() {
  renderRfqItems();
  const withEmail = suppliers.filter((s) => s.active);
  $('rfqSuppliers').innerHTML = withEmail.length ? withEmail.map((s) => `
    <label class="check-row">
      <input type="checkbox" class="rfq-sup" value="${escapeHtml(s.id)}" ${s.email ? '' : 'disabled'}>
      <span>${escapeHtml(s.name)} <span style="color:var(--slate);font-size:10.5px">${s.email ? escapeHtml(s.email) : 'sin email — configúralo en Proveedores'}</span></span>
    </label>`).join('') : '<div class="state">Sin proveedores.</div>';
  renderRfqHistory();
  renderRfqComparador();
}

// Compara las ofertas ya respondidas (con importe) de la solicitud de
// presupuesto — no hay precio por partida en el RFQ, así que la
// comparación es por importe total ofertado por proveedor.
function renderRfqComparador() {
  const el = $('rfqComparador');
  if (!el) return;
  const rfqs = (project.rfqs || []).filter((r) => r.status === 'respondida' && r.quotedAmount != null);
  if (!rfqs.length) {
    el.innerHTML = '<div class="state">Aún no hay ofertas respondidas que comparar.</div>';
    return;
  }
  const sorted = rfqs.slice().sort((a, b) => (a.quotedAmount || 0) - (b.quotedAmount || 0));
  const min = sorted[0].quotedAmount;
  el.innerHTML = `
    <table class="tbl">
      <thead><tr><th>Proveedor</th><th class="r">Importe</th><th class="r">Diferencia vs. más barato</th></tr></thead>
      <tbody>
        ${sorted.map((r, i) => {
          const diff = r.quotedAmount - min;
          const diffPct = min > 0 ? (diff / min) * 100 : 0;
          return `<tr${i === 0 ? ' style="background:rgba(26,140,74,.06)"' : ''}>
            <td>${i === 0 ? '🏆 ' : ''}${escapeHtml(r.supplierName)}</td>
            <td class="r"><strong>${fmtMoney(r.quotedAmount)}</strong></td>
            <td class="r">${i === 0 ? '—' : '+' + fmtMoney(diff) + ' (' + fmtPct(diffPct) + ')'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function renderRfqItems() {
  const items = project ? (project.items || []) : [];
  const el = $('rfqItems');
  if (!el) return;
  el.innerHTML = items.length ? items.map((it, i) => `
    <label class="check-row">
      <input type="checkbox" class="rfq-item" value="${i}" checked>
      <span>${escapeHtml(it.name)} <span style="color:var(--slate);font-size:10.5px">· ${it.quantity} ${escapeHtml(it.unit || 'ud')}</span></span>
    </label>`).join('') : '<div class="state">Añade materiales en la pestaña Materiales.</div>';
}

function renderRfqHistory() {
  const rfqs = project.rfqs || [];
  $('rfqHistory').innerHTML = rfqs.length ? rfqs.slice().reverse().map((r) => {
    const idx = project.rfqs.indexOf(r);
    return `<tr>
      <td style="font-size:11px">${new Date(r.sentAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
      <td>${escapeHtml(r.supplierName)}</td>
      <td style="font-size:11px;color:var(--slate)">${(r.items || []).length} artículos</td>
      <td>
        <select onchange="updRfq(${idx},'status',this.value)" style="padding:4px 6px;border:1px solid rgba(26,34,54,.12);border-radius:5px;font-size:11px">
          <option value="enviada" ${r.status === 'enviada' ? 'selected' : ''}>Enviada</option>
          <option value="respondida" ${r.status === 'respondida' ? 'selected' : ''}>Respondida</option>
          <option value="error" ${r.status === 'error' ? 'selected' : ''}>Error</option>
        </select>
        ${r.sendError ? `<div style="font-size:10px;color:var(--red)">${escapeHtml(r.sendError)}</div>` : ''}
      </td>
      <td class="r"><input class="num" type="number" min="0" step="1" value="${r.quotedAmount != null ? r.quotedAmount : ''}" placeholder="—" onchange="updRfq(${idx},'quotedAmount',this.value)"></td>
    </tr>`;
  }).join('') : '<tr><td colspan="5" class="tbl-empty">Ninguna solicitud enviada todavía.</td></tr>';
}

function updRfq(i, field, value) {
  const r = project.rfqs[i];
  if (!r) return;
  r[field] = field === 'quotedAmount' ? (value === '' ? null : Number(value)) : value;
  saveProject(false);
}
window.updRfq = updRfq;

function selectedRfqData() {
  const itemIdxs = Array.from(document.querySelectorAll('.rfq-item:checked')).map((c) => Number(c.value));
  const supplierIds = Array.from(document.querySelectorAll('.rfq-sup:checked')).map((c) => c.value);
  const items = itemIdxs.map((i) => project.items[i]).filter(Boolean)
    .map((it) => ({ name: it.name, quantity: it.quantity, unit: it.unit || 'ud' }));
  return { items, supplierIds };
}

function previewRfq() {
  const { items, supplierIds } = selectedRfqData();
  if (!items.length) { toast('Selecciona al menos un artículo', 'error'); return; }
  if (!supplierIds.length) { toast('Selecciona al menos un proveedor (con email)', 'error'); return; }
  const sups = supplierIds.map((id) => suppliers.find((s) => s.id === id)).filter(Boolean);
  const msg = $('rfqMessage').value.trim();

  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `
    <div class="modal">
      <div class="modal-head"><div class="t">Vista previa de la solicitud</div><div class="s">Se enviará un email por proveedor</div></div>
      <div class="modal-body">
        <p><strong>Para:</strong> ${sups.map((s) => escapeHtml(s.name) + ' &lt;' + escapeHtml(s.email) + '&gt;').join(' · ')}</p>
        <p><strong>Asunto:</strong> Solicitud de presupuesto · obreko · ${escapeHtml(project.ref || '')}</p>
        <table class="tbl" style="margin:10px 0">
          <thead><tr><th>Artículo</th><th class="r">Cantidad</th></tr></thead>
          <tbody>${items.map((it) => `<tr><td>${escapeHtml(it.name)}</td><td class="r">${it.quantity} ${escapeHtml(it.unit)}</td></tr>`).join('')}</tbody>
        </table>
        ${msg ? `<p style="background:var(--sand-lt);padding:8px 12px;border-radius:6px">${escapeHtml(msg)}</p>` : ''}
        <p style="color:var(--slate);font-size:11.5px">El email sale desde obrekobot@obreko.com con la plantilla de marca. Las respuestas llegarán a esa dirección salvo que configures otro reply-to.</p>
      </div>
      <div class="modal-foot">
        <button class="btn btn-sec" id="rfqCancel">Cancelar</button>
        <button class="btn btn-pri" id="rfqConfirm">Confirmar envío (${sups.length})</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
  wrap.querySelector('#rfqCancel').addEventListener('click', () => wrap.remove());
  wrap.querySelector('#rfqConfirm').addEventListener('click', async () => {
    const btn = wrap.querySelector('#rfqConfirm');
    btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      const data = await api('rfq', {
        method: 'POST',
        body: { projectId: project.id, supplierIds, items, message: msg },
      });
      project.rfqs = data.rfqs;
      renderRfqHistory();
      wrap.remove();
      toast(`Solicitudes enviadas: ${data.sent}/${data.total}`, data.sent === data.total ? 'success' : 'error');
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Reintentar';
      toast('Error: ' + e.message, 'error');
    }
  });
}
window.previewRfq = previewRfq;

// ── Facturas ─────────────────────────────────────────────────────────────

function addInvoice() {
  const base = Number($('invBase').value) || 0;
  if (!base) { toast('Indica la base de la factura', 'error'); return; }
  const impuestoPct = Number($('invImpuesto').value) || 0;
  project.invoices = project.invoices || [];
  project.invoices.push({
    id: 'f' + Date.now().toString(36),
    tipo: $('invTipo').value,
    // Solo tiene sentido en las de proveedor: es donde se reparte el coste.
    categoria: $('invTipo').value === 'recibida' ? $('invCategoria').value : '',
    contraparte: $('invContraparte').value.trim(),
    numero: $('invNumero').value.trim(),
    fecha: $('invFecha').value || new Date().toISOString().slice(0, 10),
    base,
    impuestoPct,
    total: +(base * (1 + impuestoPct / 100)).toFixed(2),
    estado: $('invEstado').value,
  });
  ['invContraparte', 'invNumero', 'invBase'].forEach((id) => { $(id).value = ''; });
  saveProject(true);
}
window.addInvoice = addInvoice;

function renderInvoices() {
  const inv = project.invoices || [];
  $('invBody').innerHTML = inv.length ? inv.map((f, i) => `
    <tr>
      <td><span class="badge ${f.tipo === 'emitida' ? 'badge-ok' : 'badge-muted'}">${f.tipo}</span></td>
      <td>${escapeHtml(f.contraparte || '—')}</td>
      <td style="font-family:'Courier New',monospace;font-size:11px">${escapeHtml(f.numero || '—')}</td>
      <td style="font-size:11.5px">${escapeHtml(f.fecha || '—')}</td>
      <td class="r">${fmtMoney(f.base)}</td>
      <td class="r"><strong>${fmtMoney(f.total)}</strong></td>
      <td>
        <select onchange="updInvoice(${i},this.value)" style="padding:4px 6px;border:1px solid rgba(26,34,54,.12);border-radius:5px;font-size:11px">
          <option value="pendiente" ${f.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
          <option value="cobrada" ${f.estado === 'cobrada' ? 'selected' : ''}>Cobrada</option>
          <option value="pagada" ${f.estado === 'pagada' ? 'selected' : ''}>Pagada</option>
        </select>
      </td>
      <td class="r"><button class="btn btn-sm btn-danger" onclick="delInvoice(${i})">×</button></td>
    </tr>`).join('') : '<tr><td colspan="8" class="tbl-empty">Sin facturas registradas.</td></tr>';
}

function updInvoice(i, estado) {
  if (!project.invoices[i]) return;
  project.invoices[i].estado = estado;
  saveProject(false);
}
window.updInvoice = updInvoice;

function delInvoice(i) {
  if (!confirm('¿Eliminar esta factura del registro?')) return;
  project.invoices.splice(i, 1);
  saveProject(true);
}
window.delInvoice = delInvoice;

// ── Enviar a propuesta (plataforma cliente) ──────────────────────────────

const TEMPLATE_BY_TIPO = {
  'reforma integral': 'reformas.html',
  'adecuacion': 'adecuacion.html',
  'obras-pequenas': 'obras-pequenas.html',
  'mantenimiento': 'mantenimiento.html',
  'amueblar': 'reformas.html',
};

async function enviarAPropuesta() {
  await saveProject(false);
  const e = economics || {};
  const items = project.items || [];
  if (!items.length || !e.internalCost) {
    toast('El proyecto no tiene materiales o costes calculados todavía', 'error');
    return;
  }
  // Factor de venta: reparte indirectos + margen proporcionalmente entre
  // materiales y mano de obra. El coste interno NUNCA sale al documento.
  const directCost = (e.materialsCost || 0) + (e.laborCost || 0);
  const factor = directCost > 0 ? (e.suggestedPrice || directCost) / directCost : 1;

  const rows = items.map((it) => ({
    concept: it.name,
    desc: it.supplier ? 'Suministro e instalación · ' + it.supplier : 'Suministro e instalación',
    mat: +((Number(it.totalPrice) || 0) * factor).toFixed(2),
    labor: 0,
  }));
  if (e.laborCost > 0) {
    rows.push({
      concept: 'Mano de obra',
      desc: 'Ejecución completa de los trabajos descritos',
      mat: 0,
      labor: +((e.laborCost || 0) * factor).toFixed(2),
    });
  }

  const payload = {
    v: 1,
    createdAt: new Date().toISOString(),
    ref: project.ref || '',
    clientName: project.clientName || '',
    rows,
    total: +(e.suggestedPrice || 0).toFixed(2),
  };
  localStorage.setItem('obreko_budget_import', JSON.stringify(payload));
  const tpl = TEMPLATE_BY_TIPO[project.tipo] || 'reformas.html';
  window.open('/propuestas-interno/' + tpl, '_blank', 'noopener');
  toast('Presupuesto preparado — confirma la importación en la plantilla que se ha abierto', 'success');
}
window.enviarAPropuesta = enviarAPropuesta;

// ── Comparativa de mercado ───────────────────────────────────────────────

async function compararMercado() {
  const e = economics || {};
  const m2 = Number($('fM2').value) || 0;
  if (!m2 || !e.suggestedPrice) {
    toast('Necesitas m² y un PVP calculado (materiales + costes) antes de comparar', 'error');
    return;
  }
  const btn = $('benchBtn');
  btn.disabled = true; btn.textContent = 'Analizando…';
  $('benchResult').innerHTML = '<div class="state">Consultando referencia propia y estimación de mercado…</div>';
  try {
    const data = await api('benchmark', {
      method: 'POST',
      body: {
        tipo: $('fMode').value === 'amueblar' ? 'amueblar' : $('fTipo').value,
        region: $('fRegion').value,
        calidad: $('fCalidad').value,
        m2,
        pvp: e.suggestedPrice,
      },
    });
    renderBenchmark(data);
  } catch (err) {
    $('benchResult').innerHTML = '<div class="state error">Error: ' + escapeHtml(err.message) + '</div>';
  } finally {
    btn.disabled = false; btn.textContent = 'Comparar con mercado';
  }
}
window.compararMercado = compararMercado;

function renderBenchmark(data) {
  const m = data.market || {};
  const pvp = data.pvpPerM2;
  const lo = Math.min(m.low || 0, data.ownRange ? data.ownRange.min : Infinity);
  const hi = Math.max(m.high || 0, data.ownRange ? data.ownRange.max : 0, pvp);
  const span = Math.max(hi - lo, 1);
  const pos = Math.min(Math.max(((pvp - lo) / span) * 100, 2), 98);
  const verdictBadge = m.verdict === 'competitivo' ? 'badge-ok' : m.verdict === 'bajo' ? 'badge-warn' : 'badge-err';
  const verdictLabel = m.verdict === 'bajo' ? 'Por debajo de mercado' : m.verdict === 'alto' ? 'Por encima de mercado' : 'Competitivo';

  $('benchResult').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px">
      <div style="font-family:var(--serif);font-style:italic;font-size:26px">${fmtMoney(pvp)}<span style="font-size:13px;color:var(--slate)">/m²</span></div>
      <span class="badge ${verdictBadge}">${verdictLabel}</span>
    </div>
    <div style="position:relative;height:34px;margin:6px 4px 2px">
      <div style="position:absolute;left:0;right:0;top:14px;height:8px;border-radius:4px;background:linear-gradient(90deg,rgba(254,213,68,.5),rgba(26,140,74,.35),rgba(198,40,40,.4))"></div>
      <div style="position:absolute;left:${pos}%;top:4px;transform:translateX(-50%);width:4px;height:26px;background:var(--navy);border-radius:2px" title="Tu PVP"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--slate);margin:0 4px 12px">
      <span>${fmtMoney(m.low)}/m² · mercado bajo</span>
      <span>${fmtMoney(m.typical)}/m² · típico</span>
      <span>${fmtMoney(m.high)}/m² · alto</span>
    </div>
    ${data.ownRange ? `<div style="font-size:11.5px;color:var(--slate);margin-bottom:8px">Tu referencia interna: ${fmtMoney(data.ownRange.min)}–${fmtMoney(data.ownRange.max)}/m² (editable en <a href="costes-config.html">Costes</a>)</div>` : '<div style="font-size:11.5px;color:var(--slate);margin-bottom:8px">Sin referencia interna para este tipo/calidad — puedes añadirla en <a href="costes-config.html">Costes</a> con precios reales que veáis en ofertas de la competencia.</div>'}
    <div class="notice">${escapeHtml(m.analysis || '')}</div>
  `;
}

// ── Asistente IA ─────────────────────────────────────────────────────────

let aiHistory = [];

function toggleAssistant() {
  const panel = $('aiPanel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) {
    if (!aiHistory.length) {
      aiMsg('bot', '¡Hola! Soy tu asistente de presupuestos. Cuéntame el proyecto con tus palabras — por ejemplo: «reforma integral de un piso de 80 m² en La Laguna, cocina y dos baños, calidad media» — y voy rellenando la ficha y sugiriendo partidas. También puedes preguntarme precios orientativos o qué se te puede estar olvidando.');
    }
    $('aiInputField').focus();
  }
}
window.toggleAssistant = toggleAssistant;

function aiMsg(kind, text) {
  const div = document.createElement('div');
  div.className = 'ai-msg ' + kind;
  div.textContent = text;
  $('aiBody').appendChild(div);
  $('aiBody').scrollTop = $('aiBody').scrollHeight;
  return div;
}

function aiTyping() {
  const d = document.createElement('div');
  d.className = 'ai-typing';
  d.innerHTML = '<span></span><span></span><span></span>';
  $('aiBody').appendChild(d);
  $('aiBody').scrollTop = $('aiBody').scrollHeight;
  return d;
}

async function sendAssistant() {
  const field = $('aiInputField');
  const text = field.value.trim();
  if (!text) return;
  field.value = '';
  aiMsg('user', text);
  aiHistory.push({ role: 'user', content: text });

  const btn = $('aiSend');
  btn.disabled = true;
  const typing = aiTyping();
  try {
    const data = await api('assistant', {
      method: 'POST',
      body: { project: collectForm(), messages: aiHistory },
    });
    typing.remove();
    if (data.reply) {
      aiMsg('bot', data.reply);
      aiHistory.push({ role: 'assistant', content: data.reply });
    }
    for (const action of data.actions || []) {
      applyAssistantAction(action);
    }
    if ((data.actions || []).length) await saveProject(false);
  } catch (e) {
    typing.remove();
    aiMsg('bot', '⚠️ ' + e.message);
  } finally {
    btn.disabled = false;
    field.focus();
  }
}
window.sendAssistant = sendAssistant;

$('aiInputField').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAssistant(); }
});

const FIELD_MAP = {
  m2: 'fM2', tipo: 'fTipo', mode: 'fMode', region: 'fRegion', calidad: 'fCalidad',
  clientName: 'fClientName', address: 'fAddress',
  laborHours: 'fLaborHours', laborRate: 'fLaborRate', indirectPct: 'fIndirectPct', marginPct: 'fMarginPct',
};

function applyAssistantAction(action) {
  if (action.type === 'update_project' && action.fields) {
    const applied = [];
    for (const [key, value] of Object.entries(action.fields)) {
      if (key === 'estancias' && value && typeof value === 'object') {
        if (value.cocinas != null) { $('fCocinas').value = value.cocinas; applied.push('cocinas: ' + value.cocinas); }
        if (value.banos != null) { $('fBanos').value = value.banos; applied.push('baños: ' + value.banos); }
        if (value.dormitorios != null) { $('fDormitorios').value = value.dormitorios; applied.push('dormitorios: ' + value.dormitorios); }
      } else if (FIELD_MAP[key] && value != null && value !== '') {
        $(FIELD_MAP[key]).value = value;
        applied.push(key + ': ' + value);
      }
    }
    if (applied.length) aiMsg('action', '✓ Aplicado a la ficha — ' + applied.join(' · '));
  }
  if (action.type === 'add_items' && Array.isArray(action.items)) {
    project.items = project.items || [];
    for (const it of action.items) {
      const qty = Number(it.quantity) || 1;
      const price = Math.round(Number(it.unitPrice) || 0);
      project.items.push({
        name: String(it.name || ''), supplier: String(it.supplier || 'estimación'),
        capitulo: String(it.capitulo || ''),
        material: Number(it.material) || 0, manoObra: Number(it.manoObra) || 0,
        repartoEstimado: it.repartoEstimado === true,
        unit: String(it.unit || 'ud'), unitPrice: price, quantity: qty,
        totalPrice: Math.round(qty * price), reasoning: String(it.reasoning || ''),
      });
    }
    renderItems();
    aiMsg('action', '✓ ' + action.items.length + ' partida(s) añadida(s) a Materiales');
  }
}

// ── Biblioteca de partidas ───────────────────────────────────────────────

let libTimer = null;
function buscarBiblioteca() {
  clearTimeout(libTimer);
  libTimer = setTimeout(async () => {
    const q = $('libQuery').value.trim();
    try {
      const data = await api('library?mode=' + encodeURIComponent($('fMode').value) + (q ? '&q=' + encodeURIComponent(q) : ''));
      renderLibrary(data.items || []);
    } catch (e) {
      $('libResults').innerHTML = '<div class="state error">Error: ' + escapeHtml(e.message) + '</div>';
    }
  }, 300);
}
window.buscarBiblioteca = buscarBiblioteca;

function renderLibrary(items) {
  if (!items.length) {
    $('libResults').innerHTML = '<div class="state">Nada en la biblioteca todavía — guarda partidas con el botón ★.</div>';
    return;
  }
  $('libResults').innerHTML = `<table class="tbl">${items.slice(0, 20).map((l) => `
    <tr>
      <td>${escapeHtml(l.name)} ${l.timesUsed ? `<span class="badge badge-muted">${l.timesUsed}×</span>` : ''}
        ${l.supplier ? `<div style="font-size:10.5px;color:var(--slate)">${escapeHtml(l.supplier)}</div>` : ''}</td>
      <td class="r">${fmtMoney(l.unitPrice)}/${escapeHtml(l.unit || 'ud')}</td>
      <td class="r" style="white-space:nowrap">
        <button class="btn btn-sm btn-pri" onclick='usarDeBiblioteca(${JSON.stringify(JSON.stringify(l))})'>+ Añadir</button>
        <button class="btn btn-sm btn-danger" onclick="borrarDeBiblioteca('${escapeHtml(l.id)}')">×</button>
      </td>
    </tr>`).join('')}</table>`;
}

function usarDeBiblioteca(jsonStr) {
  const l = JSON.parse(jsonStr);
  project.items = project.items || [];
  project.items.push({
    name: l.name, supplier: 'Biblioteca' + (l.supplier ? ' · ' + l.supplier : ''),
    unit: l.unit || 'ud', unitPrice: l.unitPrice, quantity: 1,
    totalPrice: l.unitPrice, reasoning: l.notes || '',
  });
  renderItems();
  saveProject(false);
  api('library', { method: 'POST', body: { useId: l.id } }).catch(() => {});
  toast('Añadido: ' + l.name, 'success');
}
window.usarDeBiblioteca = usarDeBiblioteca;

async function guardarEnBiblioteca(i, btn) {
  const it = project.items[i];
  if (!it || !it.name) { toast('La partida necesita nombre y precio', 'error'); return; }
  try {
    await api('library', {
      method: 'POST',
      body: { name: it.name, supplier: it.supplier || '', unit: it.unit || 'ud', unitPrice: it.unitPrice, mode: $('fMode').value, notes: it.reasoning || '' },
    });
    if (btn) { btn.textContent = '✓'; setTimeout(() => { btn.textContent = '★'; }, 1500); }
    toast('Guardada en la biblioteca: ' + it.name, 'success');
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}
window.guardarEnBiblioteca = guardarEnBiblioteca;

async function borrarDeBiblioteca(id) {
  if (!confirm('¿Eliminar esta partida de la biblioteca?')) return;
  try {
    await api('library?id=' + encodeURIComponent(id), { method: 'DELETE' });
    buscarBiblioteca();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}
window.borrarDeBiblioteca = borrarDeBiblioteca;

// ── Montar desde texto ───────────────────────────────────────────────────

// ── Subir Excel (.xlsx) ──────────────────────────────────────────────────
// No hay parser propio de columnas: se extrae el texto de las hojas con
// SheetJS (cargado desde jsdelivr, ya permitido en la CSP del sitio para
// EmailJS) y se pasa por el mismo flujo de "Montar desde texto" — la IA de
// compose.js ya sabe interpretar un Excel pegado como texto.

const EXCEL_TEXT_LIMIT = 55000; // compose.js acepta hasta 60000 caracteres y lo trocea si hace falta

// Copia local primero: así la subida de Excel funciona aunque haya
// bloqueadores de anuncios, DNS filtrado o el CDN caído. El CDN queda
// solo como respaldo por si faltara el archivo local.
const SHEETJS_FUENTES = [
  '../js/vendor/xlsx.full.min.js',
  '/js/vendor/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
];

let sheetJsLoadPromise = null;
function loadSheetJs() {
  if (window.XLSX) return Promise.resolve();
  if (sheetJsLoadPromise) return sheetJsLoadPromise;
  sheetJsLoadPromise = new Promise((resolve, reject) => {
    const intentar = (i) => {
      if (i >= SHEETJS_FUENTES.length) {
        sheetJsLoadPromise = null; // permite reintentar en la siguiente subida
        reject(new Error('No se pudo cargar el lector de Excel'));
        return;
      }
      const s = document.createElement('script');
      s.src = SHEETJS_FUENTES[i];
      s.onload = () => (window.XLSX ? resolve() : intentar(i + 1));
      s.onerror = () => intentar(i + 1);
      document.head.appendChild(s);
    };
    intentar(0);
  });
  return sheetJsLoadPromise;
}

function abrirSubirExcel() {
  $('excelFileInput').click();
}
window.abrirSubirExcel = abrirSubirExcel;

// El build completo de SheetJS abre bastante más que .xlsx, así que se
// aceptan todos esos formatos para que valga "cualquier Excel": el moderno
// .xlsx, los antiguos .xls, los que llevan macros, los .csv que exportan
// otros programas de presupuestos y el .ods de LibreOffice.
const EXTS_TEXTO = ['csv', 'txt', 'prn', 'dif'];

// SheetJS es muy permisivo: si le das un JPG o un PDF renombrado a .xlsx no
// falla, te devuelve los bytes como si fueran texto. Se cortan antes por la
// firma del archivo para poder decir qué pasa de verdad.
const FIRMAS_NO_HOJA = [
  { bytes: [0x25, 0x50, 0x44, 0x46], nombre: 'un PDF' },
  { bytes: [0xff, 0xd8, 0xff], nombre: 'una imagen JPG' },
  { bytes: [0x89, 0x50, 0x4e, 0x47], nombre: 'una imagen PNG' },
  { bytes: [0x47, 0x49, 0x46, 0x38], nombre: 'una imagen GIF' },
  { bytes: [0x7b, 0x5c, 0x72, 0x74], nombre: 'un documento RTF' },
];

async function leerLibro(file) {
  const buf = await file.arrayBuffer();
  const cabecera = new Uint8Array(buf.slice(0, 8));
  const firma = FIRMAS_NO_HOJA.find((f) => f.bytes.every((b, i) => cabecera[i] === b));
  if (firma) throw new Error(`el archivo es ${firma.nombre}, no una hoja de cálculo.`);

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (EXTS_TEXTO.includes(ext)) {
    // Los CSV que salen de programas españoles suelen venir en Windows-1252:
    // si al leerlos como UTF-8 aparecen caracteres rotos, se reintenta.
    let texto = new TextDecoder('utf-8').decode(buf);
    if (texto.includes('\uFFFD')) texto = new TextDecoder('windows-1252').decode(buf);
    return window.XLSX.read(texto, { type: 'string' });
  }
  return window.XLSX.read(buf, { type: 'array', cellDates: true });
}

function hojaTieneDatos(wb, name) {
  const sheet = wb.Sheets[name];
  if (!sheet || !sheet['!ref']) return false;
  return window.XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).replace(/[\s,;]/g, '') !== '';
}

// Los errores de SheetJS vienen en inglés y no dicen qué hacer: se traducen
// a algo accionable para quien está subiendo el presupuesto.
function explicarErrorExcel(e, file) {
  const msg = String((e && e.message) || e);
  if (/password|encrypt/i.test(msg)) {
    return 'el archivo está protegido con contraseña. Ábrelo en Excel, guárdalo sin contraseña y vuelve a subirlo.';
  }
  if (/unsupported|corrupt|zip|CFB|cannot find|bad format|invalid/i.test(msg)) {
    return `no se reconoce "${file.name}" como hoja de cálculo. Si viene de Numbers, de Google Sheets o es un PDF, expórtalo antes a .xlsx o .csv.`;
  }
  return msg;
}

async function onExcelFileSelected(input) {
  const file = input.files && input.files[0];
  input.value = ''; // permite volver a elegir el mismo archivo después
  if (!file) return;
  toast('Leyendo ' + file.name + '…');
  try {
    await loadSheetJs();
    const wb = await leerLibro(file);
    // Se descartan las hojas vacías (portadas, hojas sueltas sin datos) para
    // no preguntar por hojas que no aportan nada.
    const sheetNames = (wb.SheetNames || []).filter((n) => hojaTieneDatos(wb, n));
    if (!sheetNames.length) throw new Error('el archivo no tiene ninguna celda con contenido.');

    if (sheetNames.length === 1) {
      abrirMontarTexto(sheetToText(wb, sheetNames[0]));
    } else {
      abrirSeleccionHojas(wb, sheetNames);
    }
  } catch (e) {
    toast('Error leyendo el Excel: ' + explicarErrorExcel(e, file), 'error');
  }
}
window.onExcelFileSelected = onExcelFileSelected;

function sheetToText(wb, name) {
  const csv = window.XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false });
  return `== ${name} ==\n${csv}`;
}

function abrirSeleccionHojas(wb, sheetNames) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-head"><div class="t">¿Qué hojas quieres usar?</div><div class="s">El Excel tiene ${sheetNames.length} hojas — elige las que tengan partidas de presupuesto (las de resumen o notas solo añaden ruido).</div></div>
      <div class="modal-body">
        ${sheetNames.map((n, i) => `
          <label class="check-row">
            <input type="checkbox" class="sheet-check" value="${i}" ${/presupuesto|detall|partida/i.test(n) ? 'checked' : ''}>
            <span>${escapeHtml(n)}</span>
          </label>`).join('')}
      </div>
      <div class="modal-foot">
        <button class="btn btn-sec" id="sheetsCancel">Cancelar</button>
        <button class="btn btn-pri" id="sheetsGo">Continuar</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
  wrap.querySelector('#sheetsCancel').addEventListener('click', () => wrap.remove());
  wrap.querySelector('#sheetsGo').addEventListener('click', () => {
    const idxs = Array.from(wrap.querySelectorAll('.sheet-check:checked')).map((c) => Number(c.value));
    if (!idxs.length) { toast('Selecciona al menos una hoja', 'error'); return; }
    const text = idxs.map((i) => sheetToText(wb, sheetNames[i])).join('\n\n');
    wrap.remove();
    abrirMontarTexto(text);
  });
}

// prefillText opcional: lo usa onExcelFileSelected() para precargar el
// texto extraído de un Excel, reutilizando el mismo flujo/IA que "Montar
// desde texto" en vez de tener un parser de partidas específico por Excel.
function abrirMontarTexto(prefillText) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `
    <div class="modal" style="max-width:640px">
      <div class="modal-head"><div class="t">Montar presupuesto desde texto</div><div class="s">Pega la obra como venga — notas, WhatsApp, Excel…</div></div>
      <div class="modal-body">
        <textarea id="composeText" rows="9" style="width:100%;padding:10px 12px;border:1px solid rgba(26,34,54,.15);border-radius:8px;font-family:var(--sans);font-size:12.5px;outline:none;resize:vertical" placeholder="Ej.: reforma baño principal 5m2, quitar bañera y poner plato ducha 120x80, alicatar hasta techo, cambiar sanitarios roca, espejo con luz, mampara. También pintar el pasillo, unos 20m2 de pared…"></textarea>
        <div id="composePreview" style="margin-top:10px"></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-sec" id="composeCancel">Cerrar</button>
        <button class="btn btn-pri" id="composeGo">Montar partidas</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const textarea = wrap.querySelector('#composeText');
  if (prefillText) {
    textarea.value = prefillText.length > EXCEL_TEXT_LIMIT
      ? prefillText.slice(0, EXCEL_TEXT_LIMIT) + '\n… (contenido recortado, el archivo era muy largo — revisa que no falte nada relevante)'
      : prefillText;
    if (prefillText.length > EXCEL_TEXT_LIMIT) toast('El Excel es enorme y se ha recortado — revisa el texto antes de montar las partidas.', 'error');
  }
  wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
  wrap.querySelector('#composeCancel').addEventListener('click', () => wrap.remove());
  textarea.focus();

  wrap.querySelector('#composeGo').addEventListener('click', async () => {
    const text = wrap.querySelector('#composeText').value.trim();
    if (text.length < 10) { toast('Escribe o pega la descripción de la obra', 'error'); return; }
    const btn = wrap.querySelector('#composeGo');
    const prev = wrap.querySelector('#composePreview');
    btn.disabled = true; btn.textContent = 'Montando…';
    prev.innerHTML = '<div class="state">La IA está montando las partidas…</div>';
    try {
      const data = await api('compose', {
        method: 'POST',
        body: { text, mode: $('fMode').value, region: $('fRegion').value, calidad: $('fCalidad').value, m2: Number($('fM2').value) || 0 },
      });
      // data.items tiene que ser una lista sí o sí: si la IA se corta a medias
      // puede llegar un string, y antes eso reventaba con "items.map is not a
      // function" en vez de decir qué había pasado.
      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) throw new Error('No se pudo extraer ninguna partida del texto.');
      prev.innerHTML = `
        ${data.truncated ? '<div class="notice" style="border-color:#C62828;color:#C62828">El texto era muy largo y puede faltar alguna partida al final — revisa la lista contra el original antes de añadirla.</div>' : ''}
        ${data.summary ? `<div class="notice">${escapeHtml(data.summary)}</div>` : ''}
        <table class="tbl">${items.map((it) => `
          <tr><td>${escapeHtml(it.name)}${it.reasoning ? `<div style="font-size:10px;color:var(--slate)">${escapeHtml(it.reasoning)}</div>` : ''}</td>
          <td class="r">${it.quantity} ${escapeHtml(it.unit || 'ud')}</td>
          <td class="r">${fmtMoney(it.unitPrice)}</td></tr>`).join('')}</table>
        <button class="btn btn-pri" style="margin-top:10px" id="composeApply">Añadir las ${items.length} partidas al proyecto</button>`;
      prev.querySelector('#composeApply').addEventListener('click', async () => {
        applyAssistantAction({ type: 'add_items', items });
        await saveProject(false);
        wrap.remove();
        toast(items.length + ' partidas añadidas', 'success');
      });
    } catch (e) {
      prev.innerHTML = '<div class="state error">Error: ' + escapeHtml(e.message) + '</div>';
    } finally {
      btn.disabled = false; btn.textContent = 'Montar partidas';
    }
  });
}
window.abrirMontarTexto = abrirMontarTexto;

// ── Revisor anti-pérdidas ────────────────────────────────────────────────

async function revisarPresupuesto() {
  const btn = $('reviewBtn');
  btn.disabled = true; btn.textContent = 'Revisando…';
  $('reviewResult').innerHTML = '<div class="state">Buscando partidas olvidadas y cantidades raras…</div>';
  try {
    const data = await api('review', { method: 'POST', body: { project: collectForm() } });
    renderReview(data);
  } catch (e) {
    $('reviewResult').innerHTML = '<div class="state error">Error: ' + escapeHtml(e.message) + '</div>';
  } finally {
    btn.disabled = false; btn.textContent = '🔍 Revisar (anti-pérdidas)';
  }
}
window.revisarPresupuesto = revisarPresupuesto;

function renderReview(data) {
  const missing = Array.isArray(data.missing) ? data.missing : [];
  const warnings = Array.isArray(data.warnings) ? data.warnings : [];
  const strengths = Array.isArray(data.strengths) ? data.strengths : [];
  if (data.verdict === 'completo' && !warnings.length && !strengths.length) {
    $('reviewResult').innerHTML = '<div class="notice" style="border-left-color:var(--green)">✓ El presupuesto parece completo para este tipo de obra.</div>';
    return;
  }
  $('reviewResult').innerHTML = `
    ${strengths.length ? `<div class="notice" style="border-left-color:var(--green)"><strong>✓ Puntos fuertes:</strong><br>${strengths.map(escapeHtml).join('<br>')}</div>` : ''}
    ${missing.length ? `
      <div class="notice" style="border-left-color:var(--red)"><strong>Posibles partidas olvidadas (${missing.length}):</strong></div>
      <table class="tbl" style="margin-bottom:10px">${missing.map((m, i) => `
        <tr>
          <td>${escapeHtml(m.name)}<div style="font-size:10.5px;color:var(--slate)">${escapeHtml(m.reason)}</div></td>
          <td class="r">${m.quantity} ${escapeHtml(m.unit || 'ud')}</td>
          <td class="r">${fmtMoney(m.unitPrice)}</td>
          <td class="r"><button class="btn btn-sm btn-pri" onclick='anadirFaltante(${JSON.stringify(JSON.stringify(m))}, this)'>+ Añadir</button></td>
        </tr>`).join('')}</table>` : ''}
    ${warnings.length ? `<div class="notice">${warnings.map(escapeHtml).join('<br>')}</div>` : ''}
  `;
}

function anadirFaltante(jsonStr, btn) {
  const m = JSON.parse(jsonStr);
  applyAssistantAction({ type: 'add_items', items: [{ name: m.name, supplier: 'estimación', unit: m.unit, unitPrice: m.unitPrice, quantity: m.quantity, reasoning: m.reason }] });
  saveProject(false);
  if (btn) { btn.disabled = true; btn.textContent = '✓ Añadida'; }
}
window.anadirFaltante = anadirFaltante;

// ── Memoria descriptiva IA ───────────────────────────────────────────────

async function generarMemoria() {
  const btn = $('memoriaBtn');
  btn.disabled = true; btn.textContent = 'Redactando…';
  try {
    const data = await api('memoria', { method: 'POST', body: { project: collectForm() } });
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `
      <div class="modal" style="max-width:640px">
        <div class="modal-head"><div class="t">Memoria descriptiva para la propuesta</div><div class="s">Redactada por IA a partir de las partidas — revísala antes de usarla</div></div>
        <div class="modal-body">
          <div id="memoriaText" style="white-space:pre-wrap;font-size:12.5px;line-height:1.7;background:var(--sand-lt);padding:14px 16px;border-radius:8px">${escapeHtml(data.memoria || '')}</div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-sec" id="memClose">Cerrar</button>
          <button class="btn btn-pri" id="memCopy">Copiar al portapapeles</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
    wrap.querySelector('#memClose').addEventListener('click', () => wrap.remove());
    wrap.querySelector('#memCopy').addEventListener('click', async () => {
      await navigator.clipboard.writeText(data.memoria || '');
      wrap.querySelector('#memCopy').textContent = '✓ Copiada';
    });
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '📝 Memoria IA';
  }
}
window.generarMemoria = generarMemoria;

// ── Informe de revisión y recomendación (descargable en Word) ───────────
// Combina "Revisar (anti-pérdidas)" y "Comparar con mercado" en un único
// documento. No hace una tercera llamada a la IA: es una síntesis de lo
// que ya devuelven review.js y benchmark.js.

async function generarInforme() {
  const btn = $('informeBtn');
  btn.disabled = true; btn.textContent = 'Generando…';
  try {
    await saveProject(false);
    const e = economics || {};
    const m2 = Number($('fM2').value) || 0;
    const body = { project: collectForm() };

    const [reviewRes, benchRes] = await Promise.all([
      (project.items || []).length
        ? api('review', { method: 'POST', body }).catch((err) => ({ error: err.message }))
        : Promise.resolve(null),
      (m2 && e.suggestedPrice)
        ? api('benchmark', {
            method: 'POST',
            body: {
              tipo: $('fMode').value === 'amueblar' ? 'amueblar' : $('fTipo').value,
              region: $('fRegion').value,
              calidad: $('fCalidad').value,
              m2,
              pvp: e.suggestedPrice,
            },
          }).catch((err) => ({ error: err.message }))
        : Promise.resolve(null),
    ]);

    const html = buildInformeHtml({ p: project, e, review: reviewRes, bench: benchRes });
    mostrarInforme(html);
  } catch (err) {
    toast('Error generando el informe: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '📄 Informe IA';
  }
}
window.generarInforme = generarInforme;

function buildInformeHtml({ p, e, review, bench }) {
  const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const items = p.items || [];

  const itemsRows = items.map((it) => `
    <tr>
      <td>${escapeHtml(it.name)}</td>
      <td style="text-align:right">${it.quantity} ${escapeHtml(it.unit || 'ud')}</td>
      <td style="text-align:right">${fmtMoney(it.unitPrice)}</td>
      <td style="text-align:right">${fmtMoney(it.totalPrice)}</td>
    </tr>`).join('');

  const strengths = review && Array.isArray(review.strengths) ? review.strengths : [];
  const missing = review && Array.isArray(review.missing) ? review.missing : [];
  const warnings = review && Array.isArray(review.warnings) ? review.warnings : [];
  const reviewError = review && review.error ? review.error : (items.length ? null : 'El proyecto no tiene partidas todavía.');

  const missingRows = missing.map((m) => `
    <tr>
      <td>${escapeHtml(m.name)}<br><span style="font-size:10px;color:#5b6472">${escapeHtml(m.reason || '')}</span></td>
      <td style="text-align:right">${m.quantity} ${escapeHtml(m.unit || 'ud')}</td>
      <td style="text-align:right">${fmtMoney(m.unitPrice)}</td>
    </tr>`).join('');

  const market = bench && bench.market ? bench.market : null;
  const benchError = bench && bench.error ? bench.error : (!bench ? 'No se pudo comparar con mercado (falta m² o PVP calculado).' : null);
  const verdictLabel = market ? (market.verdict === 'bajo' ? 'Por debajo de mercado' : market.verdict === 'alto' ? 'Por encima de mercado' : 'Competitivo') : '';

  return `
    <h1 style="font-family:Georgia,serif">Informe de revisión y recomendación</h1>
    <p><strong>${escapeHtml(p.clientName || 'Proyecto')}</strong> — ${escapeHtml(p.ref || p.id || '')}<br>
    ${escapeHtml(p.tipo || '')} · ${p.m2 || '?'} m² · ${p.region === 'madrid' ? 'Madrid' : 'Tenerife'}<br>
    Fecha: ${fecha}</p>

    <h2>Resumen económico</h2>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
      <tr><td>Coste de materiales</td><td style="text-align:right">${fmtMoney(e.materialsCost)}</td></tr>
      <tr><td>Mano de obra</td><td style="text-align:right">${fmtMoney(e.laborCost)}</td></tr>
      <tr><td>Coste interno total</td><td style="text-align:right">${fmtMoney(e.internalCost)}</td></tr>
      <tr><td><strong>PVP sugerido (sin impuestos)</strong></td><td style="text-align:right"><strong>${fmtMoney(e.suggestedPrice)}</strong></td></tr>
      <tr><td>IGIC/IVA (${fmtPct(e.taxPct)})</td><td style="text-align:right">${fmtMoney(e.taxAmount)}</td></tr>
      <tr><td><strong>PVP con IGIC/IVA</strong></td><td style="text-align:right"><strong>${fmtMoney(e.suggestedPriceWithTax)}</strong></td></tr>
    </table>

    <h2>Puntos fuertes</h2>
    ${strengths.length ? `<ul>${strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : `<p>${escapeHtml(reviewError || 'Sin puntos destacados detectados.')}</p>`}

    <h2>Posibles partidas olvidadas</h2>
    ${missing.length ? `
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
        <tr><th>Partida</th><th>Cantidad</th><th>Precio orientativo</th></tr>
        ${missingRows}
      </table>` : `<p>${escapeHtml(reviewError || 'No se han detectado huecos relevantes.')}</p>`}

    <h2>Avisos</h2>
    ${warnings.length ? `<ul>${warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>` : '<p>Sin avisos.</p>'}

    <h2>Comparativa con el mercado</h2>
    ${market ? `
      <p>Tu PVP: <strong>${fmtMoney(bench.pvpPerM2)}/m²</strong> — <strong>${verdictLabel}</strong></p>
      <p>Rango de mercado: ${fmtMoney(market.low)} – ${fmtMoney(market.typical)} (típico) – ${fmtMoney(market.high)} €/m²</p>
      <p>${escapeHtml(market.analysis || '')}</p>
    ` : `<p>${escapeHtml(benchError)}</p>`}

    <h2>Partidas del presupuesto</h2>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
      <tr><th>Concepto</th><th>Cantidad</th><th>Precio ud.</th><th>Total</th></tr>
      ${itemsRows || '<tr><td colspan="4">Sin partidas</td></tr>'}
    </table>
  `;
}

function mostrarInforme(bodyHtml) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `
    <div class="modal" style="max-width:760px;max-height:85vh;overflow:auto">
      <div class="modal-head"><div class="t">Informe de revisión y recomendación</div><div class="s">Revisa el contenido antes de descargarlo — combina "Revisar" y "Comparar con mercado"</div></div>
      <div class="modal-body">
        <div id="informeBody" style="font-size:12.5px;line-height:1.6">${bodyHtml}</div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-sec" id="informeClose">Cerrar</button>
        <button class="btn btn-pri" id="informeWord">Descargar Word</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click', (ev) => { if (ev.target === wrap) wrap.remove(); });
  wrap.querySelector('#informeClose').addEventListener('click', () => wrap.remove());
  wrap.querySelector('#informeWord').addEventListener('click', () => descargarInformeWord(bodyHtml));
}

// Mismo truco "HTML como .doc" que usa propuesta-reforma/plantilla.html
// (guardarWord): Word abre un Blob application/msword con HTML dentro
// como si fuera un documento real. No es OOXML, pero se abre y edita
// perfectamente en Word/LibreOffice, sin depender de librerías backend.
function descargarInformeWord(bodyHtml) {
  const doc = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Informe</title></head>' +
    '<body style="font-family:Calibri,Arial,sans-serif;font-size:11pt">' + bodyHtml + '</body></html>';
  const blob = new Blob([doc], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'informe-' + (project.ref || project.id || 'presupuesto') + '.doc';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Plantillas reutilizables ─────────────────────────────────────────────

async function guardarComoPlantilla() {
  const items = project.items || [];
  if (!items.length) { toast('El proyecto no tiene partidas que guardar como plantilla', 'error'); return; }
  const name = prompt('Nombre de la plantilla (ej. "Reforma integral 1 dormitorio"):', project.tipo || '');
  if (!name || !name.trim()) return;
  try {
    await api('templates', {
      method: 'POST',
      body: {
        name: name.trim(),
        tipo: project.tipo,
        mode: project.mode,
        region: project.region,
        items,
        laborHours: project.laborHours,
        laborRate: project.laborRate,
        indirectPct: project.indirectPct,
        marginPct: project.marginPct,
        taxPct: project.taxPct,
      },
    });
    toast('Plantilla guardada ✓ — ya disponible al crear un proyecto nuevo', 'success');
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}
window.guardarComoPlantilla = guardarComoPlantilla;

// ── Bootstrap ────────────────────────────────────────────────────────────
window.BT.initAuth(load);
