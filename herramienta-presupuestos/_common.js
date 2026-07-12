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

  function initAuth(onEnter) {
    const enter = async () => {
      $('loginWrap').style.display = 'none';
      $('main').classList.add('show');
      const lo = $('btnLogout');
      if (lo) lo.style.display = 'inline-block';
      await onEnter();
    };

    $('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = $('pinInput').value.trim();
      $('loginBtn').disabled = true;
      $('loginBtn').textContent = 'Comprobando…';
      $('loginErr').classList.remove('show');
      const r = await fetch('/api/budget-tool/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }),
      });
      $('loginBtn').disabled = false;
      $('loginBtn').textContent = 'Acceder';
      if (!r.ok) {
        $('loginErr').classList.add('show');
        $('pinInput').select();
        return;
      }
      enter();
    });

    (async () => {
      const r = await fetch('/api/budget-tool/auth');
      const j = await r.json().catch(() => ({ authenticated: false }));
      if (j.authenticated) enter();
      else { $('loginWrap').style.display = 'flex'; $('pinInput').focus(); }
    })();
  }

  return { $, escapeHtml, fmtMoney, fmtPct, toast, api, logout, initAuth };
})();
window.logout = window.BT.logout;
