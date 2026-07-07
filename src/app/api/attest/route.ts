import { Resend } from "resend";
import { db, renderEmail, infoBox } from "@/lib/core";

export const runtime = "nodejs";
const resend = new Resend(process.env.RESEND_API_KEY!);
const kr = (n: number) => new Intl.NumberFormat("sv-SE").format(n) + " kr";

const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function page(title: string, inner: string, color = "#1b4332") {
  return new Response(`<!DOCTYPE html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head>
<body style="margin:0;background:#eeeeee;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<div style="background:#fff;border:1px solid #e5e5e5;border-radius:18px;padding:36px;max-width:440px;text-align:center;margin:20px;">${inner}</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
const icon = (sym: string, color: string) =>
  `<div style="width:56px;height:56px;border-radius:50%;background:${color};color:#fff;font-size:26px;line-height:56px;margin:0 auto 18px;">${sym}</div>`;

// SÄKERHETSFIX (revision K1): tillståndsändring får ALDRIG ske via GET —
// mejlklienters länkskannrar (Outlook Safe Links m.fl.) förhandsbesöker länkar
// och kunde tidigare godkänna/avslå ordrar automatiskt.
// GET visar nu endast en bekräftelsesida; själva beslutet sker i POST.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const t = url.searchParams.get("token") || "";
  const action = url.searchParams.get("action") === "reject" ? "reject" : "approve";

  if (!t) return page("Ogiltig länk", icon("✕", "#b91c1c") + `<h1 style="font-size:20px;margin:0 0 8px;">Ogiltig länk</h1><p style="font-size:14px;color:#666;margin:0;">Attest-länken saknas.</p>`);

  const { data: order } = await db.from("orders").select("*").eq("attest_token", t).maybeSingle();
  if (!order) return page("Ogiltig länk", icon("✕", "#b91c1c") + `<h1 style="font-size:20px;margin:0 0 8px;">Ogiltig länk</h1><p style="font-size:14px;color:#666;margin:0;">Ordern hittades inte.</p>`);
  if (order.status !== "pending_attest") {
    const done = order.status === "rejected" ? "avslagen" : "godkänd";
    return page("Redan hanterad", icon("✓", "#666666") + `<h1 style="font-size:20px;margin:0 0 8px;">Redan hanterad</h1><p style="font-size:14px;color:#666;margin:0;">Order #${order.ticket} är redan ${done}.</p>`);
  }

  const { data: staff } = await db.from("staff").select("name, email").eq("id", order.staff_id).single();
  const who = esc(staff?.name || staff?.email || "-");
  const isApprove = action === "approve";
  const other = isApprove ? "reject" : "approve";

  return page(
    "Bekräfta attest",
    icon(isApprove ? "✓" : "✕", isApprove ? "#1b4332" : "#b91c1c") +
    `<h1 style="font-size:20px;margin:0 0 6px;">${isApprove ? "Godkänn" : "Avslå"} order #${order.ticket}?</h1>
     <p style="font-size:14px;color:#666;margin:0 0 6px;">Beställare: ${who}</p>
     <p style="font-size:18px;font-weight:700;margin:0 0 22px;">${kr(order.total)}</p>
     <form method="POST" action="/api/attest" style="margin:0;">
       <input type="hidden" name="token" value="${esc(t)}">
       <input type="hidden" name="action" value="${action}">
       <button type="submit" style="width:100%;border:0;cursor:pointer;background:${isApprove ? "#15803d" : "#b91c1c"};color:#fff;border-radius:999px;padding:14px 20px;font-size:14px;font-weight:700;">
         Bekräfta ${isApprove ? "godkännande" : "avslag"}
       </button>
     </form>
     <a href="/api/attest?token=${encodeURIComponent(t)}&action=${other}" style="display:inline-block;margin-top:14px;font-size:12.5px;color:#666;">…eller ${isApprove ? "avslå" : "godkänn"} istället</a>`
  );
}

export async function POST(req: Request) {
  const form = await req.formData();
  const t = String(form.get("token") || "");
  const action = form.get("action") === "reject" ? "rejected" : "approved";

  if (!t) return page("Ogiltig begäran", icon("✕", "#b91c1c") + `<h1 style="font-size:20px;margin:0;">Ogiltig begäran</h1>`);
  const { data: order } = await db.from("orders").select("*").eq("attest_token", t).maybeSingle();
  if (!order) return page("Ogiltig länk", icon("✕", "#b91c1c") + `<h1 style="font-size:20px;margin:0;">Ordern hittades inte</h1>`);
  if (order.status !== "pending_attest") {
    const done = order.status === "rejected" ? "avslagen" : "godkänd";
    return page("Redan hanterad", icon("✓", "#666666") + `<h1 style="font-size:20px;margin:0 0 8px;">Redan hanterad</h1><p style="font-size:14px;color:#666;margin:0;">Order #${order.ticket} är redan ${done}.</p>`);
  }

  const newStatus = action === "approved" ? "processing" : "rejected";
  await db.from("orders").update({ status: newStatus, decided_at: new Date().toISOString() }).eq("id", order.id);

  // Kvot dras först vid godkännande i attest-modellen? Nej — kvot gäller quota-modellen.
  const { data: tenant } = await db.from("tenants").select("*").eq("id", order.tenant_id).single();
  const { data: staff } = await db.from("staff").select("*").eq("id", order.staff_id).single();
  const brand = { companyName: tenant!.name, color: tenant!.brand_color, footerLines: tenant!.footer_lines };

  // Notifiera beställaren — med felkontroll (revision H1)
  if (staff?.email) {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM || "OA Personalshop <shop@oasystems.se>",
      to: staff.email,
      subject: `Order #${order.ticket} ${action === "approved" ? "godkänd ✓" : "avslogs"} — ${tenant!.name}`,
      html: renderEmail({
        brand, eyebrow: "Orderbesked", title: tenant!.name, badge: `Order #${order.ticket}`,
        bodyHtml: infoBox(action === "approved"
          ? "Din order är godkänd och skickas nu till behandling. Du meddelas när den är klar att hämta."
          : "Din order avslogs av attestansvarig. Hör av dig till din chef om du har frågor."),
      }),
      text: `Order #${order.ticket} ${action === "approved" ? "godkänd" : "avslagen"}.`,
    });
    if (error) console.error("ATTEST: mejl till beställare misslyckades:", JSON.stringify(error));
  }
  // Godkänd order -> notis till produktion/kontakt — med felkontroll
  if (action === "approved" && tenant!.contact_email) {
    const { data: items } = await db.from("order_items").select("*").eq("order_id", order.id);
    const list = (items || []).map((i) => `${i.product_name}${i.size ? " (" + i.size + ")" : ""} ×${i.qty}`).join("\n");
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM || "OA Personalshop <shop@oasystems.se>",
      to: tenant!.contact_email,
      subject: `[Order #${order.ticket}] Godkänd — ${tenant!.name}`,
      html: renderEmail({
        brand, eyebrow: "Order godkänd — redo att behandlas", title: tenant!.name, badge: `Order #${order.ticket}`,
        bodyHtml: infoBox("Beställare: " + (staff?.name || staff?.email || "-") + "\n\n" + list),
      }),
      text: `Order #${order.ticket} godkänd.\n${list}`,
    });
    if (error) console.error("ATTEST: produktionsnotis misslyckades:", JSON.stringify(error));
  }

  return page(
    action === "approved" ? "Order godkänd!" : "Order avslagen",
    icon(action === "approved" ? "✓" : "✕", action === "approved" ? "#15803d" : "#b91c1c") +
    `<h1 style="font-size:20px;margin:0 0 8px;">${action === "approved" ? "Order godkänd!" : "Order avslagen"}</h1>
     <p style="font-size:14px;color:#666;margin:0;">Order #${order.ticket} · Beställaren har meddelats via e-post.</p>`
  );
}
