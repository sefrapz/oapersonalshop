import { Resend } from "resend";
import { db, renderEmail, infoBox } from "@/lib/core";

// Delad attestlogik (revisionsprincip: EN källa) — används av
// 1. mejllänkens POST-bekräftelse (/api/attest) och
// 2. chefens attestkorg i butiken (/api/shop/attest-decide).

const resend = new Resend(process.env.RESEND_API_KEY!);
const kr = (n: number) => new Intl.NumberFormat("sv-SE").format(n) + " kr";

export async function decideOrder(order: any, action: "approved" | "rejected", decidedBy = "") {
  const newStatus = action === "approved" ? "processing" : "rejected";
  await db.from("orders").update({ status: newStatus, decided_at: new Date().toISOString() }).eq("id", order.id);

  const { data: tenant } = await db.from("tenants").select("*").eq("id", order.tenant_id).single();
  const { data: staff } = await db.from("staff").select("*").eq("id", order.staff_id).single();
  const brand = { companyName: tenant!.name, color: tenant!.brand_color, footerLines: tenant!.footer_lines };

  if (staff?.email) {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM || "OA Personalshop <shop@oasystems.se>",
      to: staff.email,
      subject: `Order #${order.ticket} ${action === "approved" ? "godkänd ✓" : "avslogs"} — ${tenant!.name}`,
      html: renderEmail({
        brand, eyebrow: "Orderbesked", title: tenant!.name, badge: `Order #${order.ticket}`,
        bodyHtml: infoBox(action === "approved"
          ? "Din order är godkänd" + (decidedBy ? " av " + decidedBy : "") + " och skickas nu till behandling. Du meddelas när den är klar att hämta."
          : "Din order avslogs" + (decidedBy ? " av " + decidedBy : " av attestansvarig") + ". Hör av dig till din chef om du har frågor."),
      }),
      text: `Order #${order.ticket} ${action === "approved" ? "godkänd" : "avslagen"}.`,
    });
    if (error) console.error("ATTEST: mejl till beställare misslyckades:", JSON.stringify(error));
  }

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

  return { ticket: order.ticket, status: newStatus };
}
