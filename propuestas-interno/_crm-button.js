// Script compartido: inyecta el botón "💾 Guardar en HubSpot" en la toolbar
// de cada propuesta HTML. Extrae los datos del cliente / ref / importe del DOM
// y llama a /api/crm/hubspot para crear contacto + deal.

(function() {
  'use strict';

  const TITLE_MAP = {
    'reformas':              'Reforma integral residencial',
    'adecuacion':            'Adecuación de espacios',
    'obras-pequenas':        'Obras pequeñas y mejoras',
    'mantenimiento':         'Mantenimiento preventivo y correctivo',
    'manitas':               'Servicio manitas profesional',
    'hogar-conectado':       'Hogar conectado e inteligente',
    'inversion-alquiler':    'Inversión y alquiler',
    'mantenimiento-pronexo': 'Mantenimiento con Pronexo Habitat',
  };

  // Defaults de tipo/frecuencia según el tipo de propuesta
  const DEFAULTS = {
    'reformas':              { tipo:'one_off',    frequency:'one_time' },
    'adecuacion':            { tipo:'one_off',    frequency:'one_time' },
    'obras-pequenas':        { tipo:'one_off',    frequency:'one_time' },
    'inversion-alquiler':    { tipo:'one_off',    frequency:'one_time' },
    'manitas':               { tipo:'one_off',    frequency:'one_time' },
    'hogar-conectado':       { tipo:'one_off',    frequency:'one_time' },
    'mantenimiento':         { tipo:'recurring',  frequency:'monthly'  },
    'mantenimiento-pronexo': { tipo:'recurring',  frequency:'monthly'  },
  };

  function getProposalSlug() {
    const path = window.location.pathname;
    const m = path.match(/\/propuestas\/([^/]+?)(?:\.html)?\/?$/);
    return m ? m[1] : 'desconocida';
  }

  function parseAmount(text) {
    if (!text) return 0;
    // "12.345,67 €" → 12345.67
    const cleaned = text.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    const m = cleaned.match(/[-+]?\d*\.?\d+/);
    return m ? parseFloat(m[0]) : 0;
  }

  function txt(sel) {
    const el = document.querySelector(sel);
    return el ? (el.textContent || '').trim() : '';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function extractData() {
    const slug = getProposalSlug();

    // Cliente: en cada propuesta es .cover-client-name
    let clientName = txt('.cover-client-name');
    // Dirección / contexto
    let clientAddress = txt('.cover-client-addr');
    // Ref del documento
    let proposalRef = txt('.cover-meta-ref');
    // Importe total (con IVA) — varios selectores
    let amountText = '';
    ['#grand', '.grand', '#budget-grand', '.budget-grand', '[data-crm="amount"]'].some(sel => {
      const t = txt(sel);
      if (t) { amountText = t; return true; }
      return false;
    });
    if (!amountText) {
      const cells = Array.from(document.querySelectorAll('td')).reverse();
      for (const c of cells) {
        const t = (c.textContent || '').trim();
        if (/€/.test(t) && /\d/.test(t)) { amountText = t; break; }
      }
    }

    // Importe sin IVA — base imponible / subtotal
    let amountSinIvaText = '';
    ['#baseImp', '.baseImp', '#subtotal', '.subtotal', '#budget-base', '[data-crm="amount-sin-iva"]'].some(sel => {
      const t = txt(sel);
      if (t) { amountSinIvaText = t; return true; }
      return false;
    });

    const def = DEFAULTS[slug] || { tipo:'one_off', frequency:'one_time' };

    return {
      slug,
      title: TITLE_MAP[slug] || slug,
      ref: proposalRef,
      url: window.location.origin + window.location.pathname.replace(/\.html$/, ''),
      amount: parseAmount(amountText),
      amountText,
      amountSinIva: parseAmount(amountSinIvaText),
      amountSinIvaText,
      clientName,
      clientAddress,
      defaultTipo: def.tipo,
      defaultFrequency: def.frequency,
    };
  }

  function toast(msg, type) {
    const existing = document.getElementById('crmToast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.id = 'crmToast';
    t.textContent = msg;
    const bg = type === 'error' ? '#C62828' : (type === 'success' ? '#1a8c4a' : '#1A2236');
    t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:10000;background:'+bg+';color:#fff;padding:12px 20px;border-radius:8px;font-family:"DM Sans",Arial,sans-serif;font-size:13px;box-shadow:0 6px 24px rgba(0,0,0,.3);max-width:92%;text-align:center;line-height:1.45;';
    document.body.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 5000);
  }

  function openCrmDialog(data) {
    const old = document.getElementById('crmDialogWrap');
    if (old) old.remove();

    const wrap = document.createElement('div');
    wrap.id = 'crmDialogWrap';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(10,15,30,.65);display:flex;align-items:center;justify-content:center;padding:20px;font-family:"DM Sans",Arial,sans-serif;';

    const bad = !data.clientName || /^nombre del|^cliente|placeholder/i.test(data.clientName);
    const amountOk = data.amount > 0;

    // Estilos compartidos compactos
    const LBL = 'display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;color:#5C7CD9;font-weight:700;margin-bottom:4px;';
    const INP = 'width:100%;padding:7px 10px;border:1px solid rgba(26,34,54,.18);border-radius:6px;font-family:inherit;font-size:12px;box-sizing:border-box;outline:none;color:#1A2236;background:#fff;';
    const SEL = INP;

    wrap.innerHTML = `
      <div style="background:#fff;border-radius:12px;max-width:440px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,.35);overflow:hidden;max-height:92vh;display:flex;flex-direction:column">
        <div style="background:#1A2236;color:#fff;padding:12px 18px;flex-shrink:0">
          <div style="font-family:Georgia,serif;font-style:italic;font-size:16px;line-height:1.15">Guardar en HubSpot CRM</div>
          <div style="font-size:9px;letter-spacing:.14em;color:#FED544;margin-top:3px;text-transform:uppercase;font-weight:600">${escapeHtml(data.title || data.slug)}</div>
        </div>
        <div style="padding:14px 18px;color:#1A2236;font-size:12px;line-height:1.5;overflow-y:auto;flex:1">

          <div style="margin-bottom:10px;padding:8px 12px;background:#FAF7EE;border-radius:6px;border:1px solid #EBE6D8;font-size:11.5px">
            <div style="display:flex;justify-content:space-between;gap:10px"><span style="color:#8896B3">Cliente</span><strong style="text-align:right">${data.clientName ? escapeHtml(data.clientName) : '<span style="color:#C62828">sin rellenar</span>'}</strong></div>
            ${data.ref ? `<div style="display:flex;justify-content:space-between;gap:10px;margin-top:3px"><span style="color:#8896B3">Ref</span><span style="font-family:Courier New,monospace;font-size:11px">${escapeHtml(data.ref)}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;gap:10px;margin-top:3px"><span style="color:#8896B3">Total</span><strong>${data.amount > 0 ? data.amount.toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €' : '<span style="color:#8896B3;font-weight:400">sin calcular</span>'}</strong></div>
          </div>

          ${bad ? `<div style="margin-bottom:10px;padding:7px 10px;background:#FEF2F2;border-left:3px solid #C62828;border-radius:4px;color:#C62828;font-size:11px;line-height:1.5">Rellena el nombre del cliente en la portada antes de guardar.</div>` : ''}

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
            <div>
              <label style="${LBL}">Email</label>
              <input id="crmEmailInput" type="email" placeholder="cliente@ejemplo.com" style="${INP}">
            </div>
            <div>
              <label style="${LBL}">Teléfono</label>
              <input id="crmPhoneInput" type="tel" placeholder="+34..." style="${INP}">
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
            <div>
              <label style="${LBL}">Importe sin IVA (€)</label>
              <input id="crmAmountSinIvaInput" type="number" step="0.01" value="${data.amountSinIva > 0 ? data.amountSinIva.toFixed(2) : ''}" placeholder="Auto" style="${INP}">
            </div>
            <div>
              <label style="${LBL}">Tipo</label>
              <select id="crmTipoSelect" style="${SEL}">
                <option value="one_off" ${data.defaultTipo==='one_off'?'selected':''}>Puntual</option>
                <option value="recurring" ${data.defaultTipo==='recurring'?'selected':''}>Recurrente</option>
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px">
            <div>
              <label style="${LBL}">Frecuencia</label>
              <select id="crmFreqSelect" style="${SEL}">
                <option value="one_time" ${data.defaultFrequency==='one_time'?'selected':''}>Única vez</option>
                <option value="monthly" ${data.defaultFrequency==='monthly'?'selected':''}>Mensual</option>
                <option value="quarterly" ${data.defaultFrequency==='quarterly'?'selected':''}>Trimestral</option>
                <option value="biannual" ${data.defaultFrequency==='biannual'?'selected':''}>Semestral</option>
                <option value="yearly" ${data.defaultFrequency==='yearly'?'selected':''}>Anual</option>
              </select>
            </div>
            <div>
              <label style="${LBL}">Estado pipeline</label>
              <select id="crmStageSelect" style="${SEL}">
                <option value="borrador">Borrador</option>
                <option value="enviada">Enviada</option>
                <option value="vista">Vista</option>
                <option value="negociando">Negociando</option>
              </select>
            </div>
          </div>
        </div>
        <div style="padding:12px 18px;border-top:1px solid rgba(26,34,54,.08);background:#FAFAF7;display:flex;gap:8px;justify-content:flex-end;flex-shrink:0">
          <button id="crmCancel" style="background:transparent;border:1px solid rgba(26,34,54,.2);color:#1A2236;padding:8px 14px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em">Cancelar</button>
          <button id="crmSubmit" ${bad?'disabled':''} style="background:${bad?'#ccc':'#FED544'};border:none;color:#1A2236;padding:8px 16px;border-radius:6px;cursor:${bad?'not-allowed':'pointer'};font-family:inherit;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">Crear en CRM</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    wrap.querySelector('#crmCancel').addEventListener('click', () => wrap.remove());
    wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });

    const submitBtn = wrap.querySelector('#crmSubmit');
    if (!bad) {
      submitBtn.addEventListener('click', async () => {
        const email = wrap.querySelector('#crmEmailInput').value.trim();
        const phone = wrap.querySelector('#crmPhoneInput').value.trim();
        const stage = wrap.querySelector('#crmStageSelect').value;
        const frequency = wrap.querySelector('#crmFreqSelect').value;
        const tipo = wrap.querySelector('#crmTipoSelect').value;
        const amountSinIvaStr = wrap.querySelector('#crmAmountSinIvaInput').value.trim();
        const amountSinIva = amountSinIvaStr ? parseFloat(amountSinIvaStr) : data.amountSinIva;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
        try {
          const res = await fetch('/api/crm/hubspot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              proposal: data.slug,
              proposalTitle: data.title,
              proposalRef: data.ref,
              proposalUrl: data.url,
              amount: data.amount,
              amountSinIva,
              frequency,
              tipo,
              stage,
              client: { name: data.clientName, email, phone, address: data.clientAddress },
            }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || ('HTTP ' + res.status));
          wrap.remove();
          toast('✅ Creado en HubSpot. Archivando snapshot...', 'success');

          // Archivo HTML en R2 — no bloquea el flujo si falla
          archiveSnapshot(data, { email, phone, amount: data.amount, amountSinIva, hubspotDealId: j.dealId }).catch(function(err){
            console.warn('Archivo snapshot falló:', err);
          });

          setTimeout(() => { if (j.dealUrl) window.open(j.dealUrl, '_blank', 'noopener'); }, 400);
        } catch (e) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Reintentar';
          toast('Error: ' + e.message, 'error');
        }
      });
    }
  }

  // Archiva un snapshot HTML del estado actual de la propuesta en R2 vía Function
  async function archiveSnapshot(data, extra) {
    // Clonamos el DOM sin el propio botón CRM ni el diálogo
    var cloneDoc = document.cloneNode(true);
    // Limpiar elementos que no deben persistir en el snapshot
    ['crm-save-btn','crm-remove-btn','estado-add-btn','estado-remove-btn','plan-line-add','plan-line-remove','toolbar','print-btn','plan-add-btn','plan-remove-btn']
      .forEach(function(cls){
        cloneDoc.querySelectorAll('.' + cls + ', #' + cls).forEach(function(el){ el.remove(); });
      });
    cloneDoc.querySelectorAll('script').forEach(function(s){ s.remove(); });
    // Congelar contenteditable como texto plano (no editable en la versión archivada)
    cloneDoc.querySelectorAll('[contenteditable]').forEach(function(el){ el.removeAttribute('contenteditable'); });
    // Inputs → convertir a texto visible preservando el valor
    cloneDoc.querySelectorAll('input').forEach(function(inp){
      var span = cloneDoc.createElement('span');
      span.textContent = inp.value || inp.getAttribute('value') || '';
      span.className = (inp.className || '') + ' archived-input';
      span.style.cssText = 'display:inline-block;border-bottom:1px solid #ccc;min-width:60px;padding:2px 4px;font-family:inherit;';
      if (inp.parentNode) inp.parentNode.replaceChild(span, inp);
    });
    cloneDoc.querySelectorAll('textarea').forEach(function(ta){
      var div = cloneDoc.createElement('div');
      div.textContent = ta.value || '';
      div.className = (ta.className || '') + ' archived-textarea';
      div.style.cssText = 'white-space:pre-wrap;border:1px solid #eee;padding:8px;font-family:inherit;border-radius:4px;';
      if (ta.parentNode) ta.parentNode.replaceChild(div, ta);
    });
    // Añadir banner superior "ARCHIVADA" para no confundir con la editable
    var banner = cloneDoc.createElement('div');
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#FED544;color:#1A2236;font-family:"DM Sans",Arial,sans-serif;font-size:11px;padding:8px 16px;z-index:999;text-align:center;letter-spacing:.08em;text-transform:uppercase;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.1);';
    var savedAt = new Date().toLocaleString('es-ES');
    banner.textContent = '📄 Propuesta archivada · snapshot del ' + savedAt;
    var style = cloneDoc.createElement('style');
    style.textContent = '@media print{[data-archive-banner]{display:none !important;}} body{padding-top:36px !important;}';
    banner.setAttribute('data-archive-banner','');
    if (cloneDoc.body){
      cloneDoc.body.appendChild(style);
      cloneDoc.body.insertBefore(banner, cloneDoc.body.firstChild);
    }
    var html = '<!DOCTYPE html>\n' + cloneDoc.documentElement.outerHTML;

    var payload = {
      html: html,
      meta: {
        ref: data.ref || '',
        slug: data.slug,
        type: data.title,
        clientName: data.clientName,
        amount: extra && extra.amount || data.amount,
        amountSinIva: extra && extra.amountSinIva || data.amountSinIva || 0,
        email: extra && extra.email || '',
        phone: extra && extra.phone || '',
        hubspotDealId: extra && extra.hubspotDealId || '',
      },
    };
    var r = await fetch('/api/archive/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error('archive HTTP ' + r.status);
    var j = await r.json();
    console.log('Snapshot archivado:', j);
    return j;
  }

  function addButton() {
    // Si ya se inyectó, no duplicar
    if (document.querySelector('.crm-save-btn')) return;

    const onClick = () => openCrmDialog(extractData());

    // Caso 1: propuestas con toolbar completa (mantenimiento, manitas, hogar-conectado, obras-pequenas, mantenimiento-pronexo)
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
      const btn = document.createElement('button');
      btn.className = 'toolbar-btn crm-save-btn';
      btn.type = 'button';
      btn.innerHTML = '💾 Guardar en CRM';
      btn.style.cssText = 'background:#5C7CD9;color:#fff;border:none;padding:0 14px;height:34px;border-radius:6px;font-family:inherit;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;margin-right:8px';
      btn.addEventListener('mouseenter', () => btn.style.background = '#4a6cc8');
      btn.addEventListener('mouseleave', () => btn.style.background = '#5C7CD9');
      btn.addEventListener('click', onClick);
      const printBtn = toolbar.querySelector('.toolbar-btn.primary');
      if (printBtn) toolbar.insertBefore(btn, printBtn);
      else toolbar.appendChild(btn);
      return;
    }

    // Caso 2: propuestas con solo un botón flotante "Imprimir / PDF"
    // (reformas, adecuacion, inversion-alquiler)
    const printBtn = document.querySelector('.print-btn, #print-btn');
    if (printBtn) {
      const btn = document.createElement('button');
      btn.className = 'crm-save-btn';
      btn.type = 'button';
      btn.innerHTML = '💾 Guardar en CRM';
      const rect = printBtn.getBoundingClientRect();
      // Clonamos estilos clave del print-btn y lo posicionamos a su izquierda
      const printStyle = window.getComputedStyle(printBtn);
      btn.style.cssText = 'position:fixed;top:' + printStyle.top + ';right:calc(' + printStyle.right + ' + ' + Math.ceil(rect.width) + 'px + 10px);z-index:200;background:#5C7CD9;color:#fff;border:none;padding:' + printStyle.padding + ';font-family:inherit;font-size:10px;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25);transition:background .2s';
      btn.addEventListener('mouseenter', () => btn.style.background = '#4a6cc8');
      btn.addEventListener('mouseleave', () => btn.style.background = '#5C7CD9');
      btn.addEventListener('click', onClick);
      document.body.appendChild(btn);

      // Ocultar también al imprimir (como hace print-btn)
      const style = document.createElement('style');
      style.textContent = '@media print{.crm-save-btn{display:none !important;}}';
      document.head.appendChild(style);
      return;
    }

    // Caso 3 (fallback): crear botón flotante genérico arriba a la derecha
    const btn = document.createElement('button');
    btn.className = 'crm-save-btn';
    btn.type = 'button';
    btn.innerHTML = '💾 Guardar en CRM';
    btn.style.cssText = 'position:fixed;top:14px;right:160px;z-index:200;background:#5C7CD9;color:#fff;border:none;padding:8px 18px;font-family:Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25)';
    btn.addEventListener('click', onClick);
    document.body.appendChild(btn);
  }

  // Auto-actualizar fecha a hoy al abrir la propuesta
  function formatDateEs(d) {
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return d.getDate() + ' de ' + months[d.getMonth()] + ' de ' + d.getFullYear();
  }
  function updateDateToToday() {
    const today = formatDateEs(new Date());
    // Selectores conocidos de fecha en portada
    const selectors = [
      '.cover-meta-date',
      '.cover-date',
      '[data-cover-date]',
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.textContent = today;
      });
    });
  }

  function init() {
    addButton();
    updateDateToToday();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
