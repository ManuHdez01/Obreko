// Helpers compartidos de la herramienta interna de presupuestos.
// Todas las páginas incluyen: topbar + login-wrap (#loginWrap con #loginForm,
// #pinInput, #loginBtn, #loginErr) + #main. BT.initAuth() cablea el login
// contra /api/budget-tool/auth y llama a onEnter() cuando hay sesión.

window.BT = (function () {
  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function fmtMoney(n) {
    return (Number(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  function fmtPct(n) {
    return n == null ? '—' : (Number(n) || 0).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' %';
  }

  function toast(msg, type) {
    const old = $('btToast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.id = 'btToast';
    t.textContent = msg;
    t.style.background = type === 'error' ? '#C62828' : (type === 'success' ? '#1a8c4a' : '#1A2236');
    document.body.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 4500);
  }

  async function api(path, opts = {}) {
    const res = await fetch('/api/budget-tool/' + path, {
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  }

  async function logout() {
    await fetch('/api/budget-tool/auth', { method: 'DELETE' });
    location.reload();
  }

  // La API interna (/api/budget-tool/*) está detrás de una aplicación de
  // Cloudflare Access distinta a la de esta página estática. La primera vez
  // que el navegador la visita, Access necesita completar una autenticación
  // silenciosa (una redirección) que un fetch() normal no puede seguir, y la
  // petición falla con "Failed to fetch". Cargar la ruta una vez en un
  // iframe oculto deja que esa redirección se complete y la cookie de esa
  // sub-app quede fijada, sin sacar al usuario de la página.
  function warmUpApiAccess() {
    return new Promise((resolve) => {
      const done = () => { clearTimeout(t); resolve(); };
      const t = setTimeout(done, 3000);
      const f = document.createElement('iframe');
      f.style.display = 'none';
      f.src = '/api/budget-tool/auth';
      f.onload = done;
      f.onerror = done;
      document.body.appendChild(f);
    });
  }

  function initAuth(onEnter) {
    const enter = async () => {
      $('loginWrap').style.display = 'none';
      $('main').classList.add('show');
      const lo = $('btnLogout');
      if (lo) lo.style.display = 'inline-block';
      await onEnter();
    };

    const showLogin = () => { $('loginWrap').style.display = 'flex'; $('pinInput').focus(); };

    $('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = $('pinInput').value.trim();
      $('loginBtn').disabled = true;
      $('loginBtn').textContent = 'Comprobando…';
      $('loginErr').classList.remove('show');
      try {
        const r = await fetch('/api/budget-tool/auth', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }),
        });
        if (!r.ok) throw new Error('bad-pin');
        enter();
      } catch {
        $('loginErr').textContent = 'No se pudo comprobar el PIN. Recarga la página y vuelve a intentarlo.';
        $('loginErr').classList.add('show');
        $('pinInput').select();
      } finally {
        $('loginBtn').disabled = false;
        $('loginBtn').textContent = 'Acceder';
      }
    });

    (async () => {
      try {
        const r = await fetch('/api/budget-tool/auth');
        const j = await r.json().catch(() => ({ authenticated: false }));
        if (j.authenticated) { enter(); return; }
      } catch {
        // Primera visita en este navegador: dejamos que Access complete su
        // autenticación silenciosa y reintentamos una vez.
        await warmUpApiAccess();
        try {
          const r2 = await fetch('/api/budget-tool/auth');
          const j2 = await r2.json().catch(() => ({ authenticated: false }));
          if (j2.authenticated) { enter(); return; }
        } catch {
          // Sigue sin ir: mostramos el login igualmente en vez de dejar la
          // página en blanco.
        }
      }
      showLogin();
    })();
  }

  // Asistente IA global (solo consulta, sin acciones) para las páginas del
  // portal que no son la ficha de proyecto. getContext() devuelve un objeto
  // con lo que ve la página (se manda a Claude como contexto).
  function mountAssistant(pageName, getContext) {
    if (document.getElementById('aiFab')) return; // la ficha de proyecto trae el suyo

    const style = document.createElement('style');
    style.textContent = `
#aiFab{position:fixed;bottom:22px;right:22px;z-index:9000;width:62px;height:62px;border-radius:50%;background:var(--yellow);border:none;cursor:pointer;box-shadow:0 6px 20px rgba(26,34,54,.35);display:flex;align-items:center;justify-content:center;transition:transform .15s;}
#aiFab:hover{transform:scale(1.07);}
#aiPanel{position:fixed;bottom:96px;right:22px;z-index:9001;width:380px;max-width:calc(100vw - 32px);height:480px;max-height:calc(100vh - 130px);background:#fff;border-radius:14px;box-shadow:0 18px 60px rgba(10,15,30,.4);display:none;flex-direction:column;overflow:hidden;}
#aiPanel.open{display:flex;}
.ai-head{background:var(--navy);color:#fff;padding:12px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;}
.ai-avatar{width:34px;height:34px;border-radius:50%;background:var(--yellow);color:var(--navy);display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-style:italic;font-size:19px;}
.ai-title{font-size:13px;font-weight:700;}
.ai-sub{font-size:10px;color:rgba(255,255,255,.5);}
.ai-close{margin-left:auto;background:none;border:none;color:rgba(255,255,255,.6);font-size:20px;cursor:pointer;line-height:1;}
.ai-body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--sand-lt);}
.ai-msg{max-width:88%;padding:9px 13px;border-radius:12px;font-size:12.5px;line-height:1.55;white-space:pre-wrap;}
.ai-msg.bot{background:#fff;border:1px solid rgba(26,34,54,.08);align-self:flex-start;border-bottom-left-radius:4px;}
.ai-msg.user{background:var(--navy);color:#fff;align-self:flex-end;border-bottom-right-radius:4px;}
.ai-input{display:flex;gap:8px;padding:10px 12px;border-top:1px solid rgba(26,34,54,.08);background:#fff;flex-shrink:0;}
.ai-input textarea{flex:1;resize:none;border:1px solid rgba(26,34,54,.15);border-radius:8px;padding:8px 10px;font-family:var(--sans);font-size:12.5px;outline:none;}
.ai-input button{background:var(--yellow);color:var(--navy);border:none;border-radius:8px;padding:0 16px;font-family:var(--sans);font-size:11px;font-weight:700;text-transform:uppercase;cursor:pointer;}
.ai-input button:disabled{background:rgba(26,34,54,.15);color:var(--slate);cursor:wait;}
@media print{#aiFab,#aiPanel{display:none !important;}}`;
    document.head.appendChild(style);

    const fab = document.createElement('button');
    fab.id = 'aiFab';
    fab.title = 'Asistente IA';
    fab.innerHTML = '<svg viewBox="0 0 100 90" width="42" height="38" aria-hidden="true"><g transform="rotate(-9 50 45)"><ellipse cx="50" cy="45" rx="38" ry="32" fill="#1A2236"/><ellipse cx="50" cy="45" rx="19" ry="16" fill="#FED544"/></g><g transform="translate(42 42)"><circle r="3.6" fill="#1A2236"/></g><g transform="translate(58 42)"><circle r="3.6" fill="#1A2236"/></g><path d="M 45 51 Q 50 55.5 55 51" stroke="#1A2236" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>';
    document.body.appendChild(fab);

    const panel = document.createElement('aside');
    panel.id = 'aiPanel';
    panel.innerHTML = `
      <div class="ai-head">
        <div class="ai-avatar">o</div>
        <div><div class="ai-title">Asistente del portal</div><div class="ai-sub">${escapeHtml(pageName)}</div></div>
        <button class="ai-close" aria-label="Cerrar">×</button>
      </div>
      <div class="ai-body" id="gaBody"></div>
      <div class="ai-input">
        <textarea id="gaInput" rows="1" placeholder="Pregúntame sobre lo que ves aquí…"></textarea>
        <button id="gaSend">Enviar</button>
      </div>`;
    document.body.appendChild(panel);

    const history = [];
    const msg = (kind, text) => {
      const d = document.createElement('div');
      d.className = 'ai-msg ' + kind;
      d.textContent = text;
      $('gaBody').appendChild(d);
      $('gaBody').scrollTop = $('gaBody').scrollHeight;
      return d;
    };

    const send = async () => {
      const field = $('gaInput');
      const text = field.value.trim();
      if (!text) return;
      field.value = '';
      msg('user', text);
      history.push({ role: 'user', content: text });
      const btn = $('gaSend');
      btn.disabled = true;
      const typing = msg('bot', '…');
      try {
        const ctx = { page: pageName, ...(getContext ? getContext() : {}) };
        const data = await api('assistant', { method: 'POST', body: { context: ctx, messages: history } });
        typing.remove();
        msg('bot', data.reply || '(sin respuesta)');
        history.push({ role: 'assistant', content: data.reply || '' });
      } catch (e) {
        typing.remove();
        msg('bot', '⚠️ ' + e.message);
      } finally {
        btn.disabled = false;
        field.focus();
      }
    };

    fab.addEventListener('click', () => {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) {
        if (!history.length) msg('bot', 'Pregúntame lo que quieras sobre esta página: interpretar las cifras, decidir márgenes, priorizar cobros o cómo usar el portal.');
        $('gaInput').focus();
      }
    });
    panel.querySelector('.ai-close').addEventListener('click', () => panel.classList.remove('open'));
    panel.querySelector('#gaInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    panel.querySelector('#gaSend').addEventListener('click', send);
  }

  return { $, escapeHtml, fmtMoney, fmtPct, toast, api, logout, initAuth, mountAssistant };
})();
window.logout = window.BT.logout;
