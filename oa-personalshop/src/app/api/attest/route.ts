import { Resend } from "resend";
import { db, renderEmail, infoBox } from "@/lib/core";

export const runtime = "nodejs";
const resend = new Resend(process.env.RESEND_API_KEY!);

// GET ?token=...&action=approve|reject — attest direkt från mejlet, ett klick
export async function GET(req: Request) {
  const url = new URL(req.url);
  const t = url.searchParams.get("token") || "";
  const action = url.searchParams.get("action") === "reject" ? "rejected" : "approved";

  const html = (title: string, text: string, color = "#15803d") =>
    new Response(`<!DOCTYPE html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#eeeeee;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<div style="background:#fff;border:1px solid #e5e5e5;border-radius:18px;padding:40px;max-width:420px;text-align:center;margin:20px;">
<div style="width:56px;height:56px;border-radius:50%;background:${color};color:#fff;font-size:26px;line-height:56px;margin:0 auto 18px;">${color === "#15803d" ? "✓" : "✕"}</div>
<h1 style="font-size:20px;margin:0 0 8px;">${title}</h1><p style="font-size:14px;color:#666;margin:0;">${text}</p></div></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } });

  if (!t) return html("Ogiltig länk", "Attest-länken saknas.", "#b91c1c");
  const { data: order } = await db.from("orders").select("*").eq("attest_token", t).maybeSingle();
  if (!order) return html("Ogiltig länk", "Ordern hittades inte.", "#b91c1c");
  if (order.status !== "pending_attest") {
    return html("Redan hanterad", `Order #${order.ticket} är redan ${order.status === "approved" || order.status === "processing" ? "godkänd" : "avslagen"}.`, "#666666");
  }

  const newStatus = action === "approved" ? "processing" : "rejected";
  await db.from("orders").update({ status: newStatus, decided_at: new Date().toISOString() }).eq("id", order.id);

  const { data: tenant } = await db.from("tenants").select("*").eq("id", order.tenant_id).single();
  const { data: staff } = await db.from("staff").select("*").eq("id", order.staff_id).single();
  const brand = { companyName: tenant!.name, color: tenant!.brand_color, footerLines: tenant!.footer_lines };

  // Notifiera beställaren
  if (staff?.email) {
    await resend.emails.send({
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
  }
  // Godkänd order -> notis till produktion/kontakt
  if (action === "approved" && tenant!.contact_email) {
    const { data: items } = await db.from("order_items").select("*").eq("order_id", order.id);
    const list = (items || []).map((i) => `${i.product_name}${i.size ? " (" + i.size + ")" : ""} ×${i.qty}`).join("\n");
    await resend.emails.send({
      from: process.env.RESEND_FROM || "OA Personalshop <shop@oasystems.se>",
      to: tenant!.contact_email,
      subject: `[Order #${order.ticket}] Godkänd — ${tenant!.name}`,
      html: renderEmail({
        brand, eyebrow: "Order godkänd — redo att behandlas", title: tenant!.name, badge: `Order #${order.ticket}`,
        bodyHtml: infoBox("Beställare: " + (staff?.name || staff?.email || "-") + "\n\n" + list),
      }),
      text: `Order #${order.ticket} godkänd.\n${list}`,
    });
  }

  return html(
    action === "approved" ? "Order godkänd!" : "Order avslagen",
    `Order #${order.ticket} · Beställaren har meddelats via e-post.`,
    action === "approved" ? "#15803d" : "#b91c1c"
  );
}
