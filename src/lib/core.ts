import { createClient } from "@supabase/supabase-js";
import { randomBytes, timingSafeEqual } from "crypto";

export const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export const token = (bytes = 24) => randomBytes(bytes).toString("hex");

export function requireAdmin(req: Request): boolean {
  const got = req.headers.get("x-admin-secret") || "";
  const want = process.env.ADMIN_SECRET || "";
  if (!want || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));  // revision M2
}

// ===== Session (personal) =====
export function sessionCookie(req: Request): string | null {
  const raw = req.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)ps_session=([a-f0-9]+)/);
  return m ? m[1] : null;
}

export async function currentStaff(req: Request) {
  const t = sessionCookie(req);
  if (!t) return null;
  const { data: s } = await db.from("sessions").select("*").eq("token", t).maybeSingle();
  if (!s || new Date(s.expires_at) < new Date()) return null;
  const { data: staff } = await db.from("staff").select("*").eq("id", s.staff_id).maybeSingle();
  const { data: tenant } = await db.from("tenants").select("*").eq("id", s.tenant_id).maybeSingle();
  if (!staff || !tenant || !tenant.active) return null;
  return { staff, tenant };
}

// ===== Kvotlogik (deterministisk — aldrig AI) =====
export function quotaLeft(tenant: any, staff: any): { left: number; unit: string } {
  if (tenant.order_model !== "quota") return { left: Infinity, unit: "" };
  if (tenant.quota_type === "items") return { left: Math.max(0, tenant.quota_value - staff.used_items), unit: "plagg" };
  return { left: Math.max(0, tenant.quota_value - staff.used_kr), unit: "kr" };
}

// ===== E-postmall (delad med OA Chat-stilen) =====
const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderEmail(o: {
  brand: { companyName: string; color: string; footerLines?: string[]; website?: string };
  eyebrow: string; title: string; badge?: string; preheader?: string;
  bodyHtml: string; cta?: { label: string; href: string }; cta2?: { label: string; href: string };
}): string {
  const b = o.brand;
  const footer = (b.footerLines || []).map((l) => `<p style="margin:2px 0;font-size:11.5px;color:#999;">${esc(l)}</p>`).join("");
  return `<!DOCTYPE html><html lang="sv"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#eeeeee;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
${o.preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${esc(o.preheader)}</div>` : ""}
<div style="max-width:560px;margin:0 auto;padding:28px 14px;">
  <div style="background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e5e5e5;">
    <div style="background:${b.color};color:#fff;padding:22px 24px;">
      <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.85;">${esc(o.eyebrow)}</p>
      <p style="margin:6px 0 0;font-size:20px;font-weight:600;">${esc(o.title)}</p>
      ${o.badge ? `<p style="margin:10px 0 0;font-size:13px;background:rgba(255,255,255,.18);display:inline-block;border-radius:999px;padding:4px 14px;font-weight:600;">${esc(o.badge)}</p>` : ""}
    </div>
    <div style="padding:24px;">
      ${o.bodyHtml}
      ${o.cta ? `<div style="text-align:center;margin:22px 0 4px;">
        <a href="${o.cta.href}" style="display:inline-block;background:${b.color};color:#fff;text-decoration:none;border-radius:999px;padding:13px 30px;font-size:14px;font-weight:600;">${esc(o.cta.label)}</a>
        ${o.cta2 ? `<br><a href="${o.cta2.href}" style="display:inline-block;margin-top:10px;color:#666;text-decoration:underline;font-size:13px;">${esc(o.cta2.label)}</a>` : ""}
      </div>` : ""}
    </div>
    <div style="border-top:1px solid #eee;padding:16px 24px 20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:12.5px;font-weight:600;color:#555;">${esc(b.companyName)}</p>${footer}
    </div>
  </div>
  <p style="text-align:center;font-size:11px;color:#aaa;margin-top:14px;">Skickat via <a href="https://oasystems.se" style="color:#aaa;">OA Systems</a></p>
</div></body></html>`;
}

export const sectionLabel = (t: string) =>
  `<p style="margin:18px 0 4px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#999;">${esc(t)}</p>`;
export const infoBox = (t: string) =>
  `<div style="background:#f7f7f7;border-radius:12px;padding:14px 16px;font-size:14px;line-height:1.6;color:#222;white-space:pre-wrap;">${esc(t)}</div>`;
export function orderTable(items: { product_name: string; size: string; qty: number; price: number }[]) {
  const kr = (n: number) => new Intl.NumberFormat("sv-SE").format(n) + " kr";
  const rows = items.map((i) =>
    `<tr><td style="padding:6px 0;font-size:13px;color:#222;">${esc(i.product_name)}${i.size ? " · " + esc(i.size) : ""}</td>
     <td style="padding:6px 0;font-size:13px;color:#666;text-align:center;">${i.qty} st</td>
     <td style="padding:6px 0;font-size:13px;color:#222;text-align:right;font-weight:600;">${kr(i.qty * i.price)}</td></tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;border-bottom:1px solid #eee;">${rows}</table>`;
}
