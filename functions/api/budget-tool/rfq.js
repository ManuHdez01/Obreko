// POST /api/budget-tool/rfq — envía una solicitud de presupuesto (RFQ) por
// email a uno o varios proveedores, vía Resend, y la registra en el proyecto.
//
// Body esperado (JSON):
//   {
//     "projectId": "p123...",
//     "supplierIds": ["chafiras", "leroy-merlin"],
//     "items": [{ "name": "...", "quantity": 3, "unit": "saco" }],
//     "message": "texto libre opcional",
//     "replyTo": "compras@obreko.com"       // opcional
//   }
//
// El frontend SIEMPRE muestra vista previa y pide confirmación antes de
// llamar aquí. Requiere RESEND_API_KEY (secreto de Cloudflare) y que cada
// proveedor tenga email configurado en /api/budget-tool/suppliers.

import { verifySession } from './_auth.js';
import { readSuppliers } from './suppliers.js';

const RESEND_URL = 'https://api.resend.com/emails';
const FROM = 'obreko <obrekobot@obreko.com>';

export async function onRequestPost({ request, env }) {
  if (!(await verifySession(request, env))) return json({ error: 'No autenticado' }, 401);
  if (!env.RESEND_API_KEY) return json({ error: 'RESEND_API_KEY no configurado' }, 503);
  if (!env.BUDGET_TOOL) return json({ error: 'KV BUDGET_TOOL no configurado' }, 503);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const projectId = String(payload.projectId || '').replace(/[^A-Za-z0-9_-]/g, '');
  const supplierIds = Array.isArray(payload.supplierIds) ? payload.supplierIds.map(String) : [];
  const items = Array.isArray(payload.items) ? payload.items.slice(0, 100) : [];
  const message = String(payload.message || '').slice(0, 2000);
  const replyTo = String(payload.replyTo || '').trim().slice(0, 200);

  if (!projectId) return json({ error: 'Falta projectId' }, 400);
  if (!supplierIds.length) return json({ error: 'Selecciona al menos un proveedor' }, 400);
  if (!items.length) return json({ error: 'La solicitud no tiene artículos' }, 400);

  const rawProject = await env.BUDGET_TOOL.get('project:' + projectId);
  if (!rawProject) return json({ error: 'Proyecto no encontrado' }, 404);
  const project = JSON.parse(rawProject);

  const suppliers = await readSuppliers(env);
  const targets = supplierIds
    .map((id) => suppliers.find((s) => s.id === id))
    .filter(Boolean);

  const missing = targets.filter((s) => !s.email);
  if (missing.length) {
    return json({ error: 'Proveedores sin email configurado: ' + missing.map((s) => s.name).join(', ') + '. Añádelo en Proveedores.' }, 400);
  }
  if (!targets.length) return json({ error: 'Ningún proveedor válido' }, 404);

  const results = [];
  for (const supplier of targets) {
    const subject = `Solicitud de presupuesto · obreko · ${project.ref || projectId}`;
    const html = buildEmailHtml({ supplier, project, items, message, replyTo });

    let sendResult;
    try {
      const res = await fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM,
          to: [supplier.email],
          ...(replyTo ? { reply_to: replyTo } : {}),
          subject,
          html,
        }),
      });
      const j = await res.json().catch(() => ({}));
      sendResult = res.ok
        ? { ok: true, emailId: j.id || null }
        : { ok: false, error: j.message || ('Resend HTTP ' + res.status) };
    } catch (e) {
      sendResult = { ok: false, error: e.message };
    }

    const rfqRecord = {
      id: 'rfq' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierEmail: supplier.email,
      sentAt: new Date().toISOString(),
      items,
      message,
      status: sendResult.ok ? 'enviada' : 'error',
      sendError: sendResult.ok ? null : sendResult.error,
      quotedAmount: null,
    };
    project.rfqs = project.rfqs || [];
    project.rfqs.push(rfqRecord);
    results.push({ supplier: supplier.name, ...sendResult, rfqId: rfqRecord.id });
  }

  project.updatedAt = new Date().toISOString();
  await env.BUDGET_TOOL.put('project:' + projectId, JSON.stringify(project));

  const okCount = results.filter((r) => r.ok).length;
  return json({ sent: okCount, total: results.length, results, rfqs: project.rfqs });
}

function buildEmailHtml({ supplier, project, items, message, replyTo }) {
  const rows = items.map((it, i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #ece8df;font-size:13px;color:#1A2236">${i + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ece8df;font-size:13px;color:#1A2236">${escapeHtml(it.name)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #ece8df;font-size:13px;color:#1A2236;text-align:right">${escapeHtml(String(it.quantity || 1))} ${escapeHtml(it.unit || 'ud')}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F1EDE0;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:#1A2236;padding:20px 24px;border-top:3px solid #FED544;">
      <div style="font-family:Georgia,serif;font-style:italic;font-size:24px;color:#ffffff;">obreko</div>
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#FED544;margin-top:4px;">Solicitud de presupuesto</div>
    </div>
    <div style="background:#ffffff;padding:24px;">
      <p style="font-size:14px;color:#1A2236;line-height:1.6;margin:0 0 16px;">Estimado equipo de ${escapeHtml(supplier.name)},</p>
      <p style="font-size:14px;color:#1A2236;line-height:1.6;margin:0 0 16px;">
        Desde <strong>obreko</strong> (empresa de reformas · Tenerife y Madrid) solicitamos presupuesto
        para los siguientes materiales, con referencia <strong>${escapeHtml(project.ref || '')}</strong>:
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 16px;">
        <thead>
          <tr>
            <th style="padding:8px 12px;background:#1A2236;color:#ffffff;font-size:11px;text-align:left;letter-spacing:1px;">#</th>
            <th style="padding:8px 12px;background:#1A2236;color:#ffffff;font-size:11px;text-align:left;letter-spacing:1px;">ARTÍCULO</th>
            <th style="padding:8px 12px;background:#1A2236;color:#FED544;font-size:11px;text-align:right;letter-spacing:1px;">CANTIDAD</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${message ? `<p style="font-size:13px;color:#555;line-height:1.6;background:#FAF7EE;border-left:3px solid #FED544;padding:10px 14px;margin:0 0 16px;">${escapeHtml(message)}</p>` : ''}
      <p style="font-size:14px;color:#1A2236;line-height:1.6;margin:0 0 4px;">
        Agradecemos respuesta con precios, disponibilidad y plazo de entrega${replyTo ? ` a <a href="mailto:${escapeHtml(replyTo)}" style="color:#5C7CD9">${escapeHtml(replyTo)}</a>` : ' respondiendo a este correo'}.
      </p>
      <p style="font-size:14px;color:#1A2236;line-height:1.6;margin:16px 0 0;">Un saludo,<br><em style="font-family:Georgia,serif;">equipo obreko</em></p>
    </div>
    <div style="padding:16px 24px;font-size:11px;color:#8896B3;text-align:center;">
      obreko · Tenerife · Madrid · <a href="https://obreko.com" style="color:#5C7CD9;text-decoration:none;">obreko.com</a> · hola@obreko.com
    </div>
  </div>
</body></html>`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
