// Lógica de index.html — lista de proyectos + creación.
const { $, escapeHtml, fmtMoney, fmtPct, toast, api } = window.BT;

let templatesCache = [];

async function loadTemplates() {
  try {
    const data = await api('templates');
    templatesCache = data.templates || [];
    const sel = $('cTemplate');
    if (sel) {
      sel.innerHTML = '<option value="">— Ninguna, empezar en blanco —</option>' +
        templatesCache.map((t) => `<option value="${t.id}">${escapeHtml(t.name)} (${t.items.length} partidas)</option>`).join('');
    }
  } catch { /* si falla, se crea sin plantillas — no bloquea la creación de proyectos */ }
}

function toggleCreate() {
  const c = $('createCard');
  c.style.display = c.style.display === 'none' ? 'block' : 'none';
  if (c.style.display === 'block') $('cName').focus();
}
window.toggleCreate = toggleCreate;

async function createProject() {
  const btn = $('createBtn');
  btn.disabled = true;
  try {
    const tpl = templatesCache.find((t) => t.id === $('cTemplate').value);
    const body = {
      clientName: $('cName').value.trim(),
      region: $('cRegion').value,
      mode: $('cMode').value,
      tipo: $('cMode').value === 'amueblar' ? 'amueblar' : $('cTipo').value,
      m2: Number($('cM2').value) || 0,
    };
    if (tpl) {
      body.items = tpl.items;
      body.laborHours = tpl.laborHours;
      body.laborRate = tpl.laborRate;
      body.indirectPct = tpl.indirectPct;
      body.marginPct = tpl.marginPct;
      body.taxPct = tpl.taxPct;
    }
    const data = await api('projects', { method: 'POST', body });
    location.href = 'proyecto.html?id=' + encodeURIComponent(data.project.id);
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    btn.disabled = false;
  }
}
window.createProject = createProject;

async function deleteProject(id, ref) {
  if (!confirm('¿Eliminar el proyecto ' + ref + '? Esta acción no se puede deshacer.')) return;
  try {
    await api('projects?id=' + encodeURIComponent(id), { method: 'DELETE' });
    toast('Proyecto eliminado', 'success');
    loadProjects();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}
window.deleteProject = deleteProject;

let lastProjects = [];

// Aviso visual cuando el coste real (facturas de proveedor recibidas) se
// acerca o supera el coste interno previsto — solo se activa si ya hay
// coste real registrado (evita falsos avisos en proyectos recién creados).
function deviationBadge(e) {
  if (!e.internalCost || !e.realCost) return '';
  const ratio = e.realCost / e.internalCost;
  if (ratio >= 1) return '<span title="Coste real ha superado el previsto" style="color:var(--red)">⚠️ </span>';
  if (ratio >= 0.9) return '<span title="Coste real cerca del límite previsto" style="color:#b8860b">● </span>';
  return '';
}

async function loadProjects() {
  const body = $('projBody');
  try {
    const data = await api('projects');
    lastProjects = data.items || [];
    if (!data.items.length) {
      body.innerHTML = '<tr><td colspan="9" class="tbl-empty">Aún no hay proyectos. Crea el primero con «+ Nuevo proyecto».</td></tr>';
      return;
    }
    body.innerHTML = data.items.map((p) => {
      const e = p.economics || {};
      const d = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '—';
      return `<tr>
        <td style="font-family:'Courier New',monospace;font-size:11px;color:var(--blue)">${escapeHtml(p.ref || '—')}</td>
        <td><a href="proyecto.html?id=${encodeURIComponent(p.id)}" style="color:var(--navy);font-weight:600;text-decoration:none">${deviationBadge(e)}${escapeHtml(p.clientName || '(sin cliente)')}</a></td>
        <td style="text-transform:capitalize">${escapeHtml(p.tipo || '—')}</td>
        <td class="r">${p.m2 || '—'}</td>
        <td class="r">${fmtMoney(e.internalCost)}</td>
        <td class="r"><strong>${fmtMoney(e.suggestedPrice)}</strong></td>
        <td class="r">${fmtPct(e.marginPct)}</td>
        <td style="font-size:11px;color:var(--slate)">${d}</td>
        <td class="r">
          <a class="btn btn-sm btn-pri" style="text-decoration:none" href="proyecto.html?id=${encodeURIComponent(p.id)}">Abrir</a>
          <button class="btn btn-sm btn-danger" onclick="deleteProject('${p.id}','${escapeHtml(p.ref || '')}')">×</button>
        </td>
      </tr>`;
    }).join('');
  } catch (e) {
    body.innerHTML = '<tr><td colspan="9" class="tbl-empty" style="color:var(--red)">Error cargando proyectos: ' + escapeHtml(e.message) + '</td></tr>';
  }
}

window.BT.initAuth(async () => {
  await Promise.all([loadProjects(), loadTemplates()]);
  window.BT.mountAssistant('Lista de proyectos', () => ({
    proyectos: lastProjects.map((p) => ({ ref: p.ref, cliente: p.clientName, tipo: p.tipo, m2: p.m2, economia: p.economics })),
  }));
});
