import { Resend } from "resend";
import { db, currentStaff, quotaLeft, token, APP_URL, renderEmail, sectionLabel, infoBox, orderTable } from "@/lib/core";

export const runtime = "nodejs";
const resend = new Resend(process.env.RESEND_API_KEY!);
const kr = (n: number) => new Intl.NumberFormat("sv-SE").format(n) + " kr";

// POST { items: [{productId, size, qty}], note?, costCenter? }
// Beställningsmodell avgörs av kundens INSTÄLLNING — ingen kod per kund:
//  free  -> processing direkt
//  attest-> pending_attest om total > threshold (annars processing); mejl till attestansvarig
//  quota -> kontrollera kvarvarande kvot; dra kvot; processing
export async function POST(req: Request) {
  const me = await currentStaff(req);
  if (!me) return Response.json({ error: "Inte inloggad" }, { status: 401 });
  const { tenant, staff } = me;

  const body = await req.json();
  const reqItems: { productId: string; size?: string; qty: number }[] = body.items || [];
  if (!reqItems.length) return Response.json({ error: "Tom varukorg" }, { status: 400 });

  // Hämta produkterna ur DB — priser tas ALDRIG från klienten
  const ids = reqItems.map((i) => i.productId);
  const { data: prods } = await db.from("products").select("*")
    .eq("tenant_id", tenant.id).eq("active", true).in("id", ids);
  const byId = new Map((prods || []).map((p) => [p.id, p]));

  const items: { product_name: string; size: string; qty: number; price: number }[] = [];
  for (const r of reqItems) {
    const p = byId.get(r.productId);
    if (!p) return Response.json({ error: "Okänd produkt i varukorgen" }, { status: 400 });
    const qty = Math.max(1, Math.min(50, Math.floor(r.qty || 1)));
    const size = p.sizes?.length ? String(r.size || "") : "";
    if (p.sizes?.length && !p.sizes.includes(size)) {
      return Response.json({ error: `Välj storlek för ${p.name}` }, { status: 400 });
    }
    items.push({ product_name: p.name, size, qty, price: p.price });
  }
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  const itemCount = items.reduce((s, i) => s + i.qty, 0);

  // Kvotkontroll
  if (tenant.order_model === "quota") {
    const q = quotaLeft(tenant, staff);
    const need = tenant.quota_type === "items" ? itemCount : total;
    if (need > q.left) {
      return Response.json({ error: `Kvoten räcker inte: ${q.left} ${q.unit} kvar i år, ordern kräver ${need} ${q.unit}.` }, { status: 422 });
    }
  }

  // Status enligt modell
  let status = "processing";
  const attestNow = tenant.order_model === "attest" && (tenant.attest_threshold === 0 || total > tenant.attest_threshold);
  if (attestNow) status = "pending_attest";

  const attest_token = attestNow ? token() : "";
  const { data: order, error } = await db.from("orders").insert({
    tenant_id: tenant.id, staff_id: staff.id, status, total,
    note: String(body.note || "").slice(0, 500),
    cost_center: String(body.costCenter || "").slice(0, 100),
    attest_token,
  }).select("id, ticket").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await db.from("order_items").insert(items.map((i) => ({ ...i, order_id: order!.id })));

  // Dra kvot direkt (fri/kvot-order går till behandling)
  if (tenant.order_model === "quota") {
    await db.from("staff").update({
      used_kr: staff.used_kr + total,
      used_items: staff.used_items + itemCount,
    }).eq("id", staff.id);
  }

  const brand = { companyName: tenant.name, color: tenant.brand_color, footerLines: tenant.footer_lines };
  const who = (staff.name || staff.email) + (body.costCenter ? " · " + body.costCenter : "");

  // Mejl 1: attestförfrågan ELLER ordernotis till kontaktadressen
  if (attestNow && tenant.approver_email) {
    await resend.emails.send({
      from: process.env.RESEND_FROM || "OA Personalshop <shop@oasystems.se>",
      to: tenant.approver_email,
      replyTo: staff.email,
      subject: `[Attest #${order!.ticket}] ${who} — ${kr(total)}`,
      html: renderEmail({
        brand, eyebrow: "Order väntar på attest", title: tenant.name, badge: `Order #${order!.ticket}`,
        preheader: `${who}: ${kr(total)}`,
        bodyHtml: sectionLabel("Beställare") + infoBox(who) +
          (body.note ? sectionLabel("Meddelande") + infoBox(body.note) : "") +
          sectionLabel("Innehåll") + orderTable(items) +
          `<p style="margin:12px 0 0;font-size:15px;font-weight:700;text-align:right;">Totalt: ${kr(total)}</p>`,
        cta: { label: "✓ Godkänn ordern", href: `${APP_URL}/api/attest?token=${attest_token}&action=approve` },
        cta2: { label: "✕ Avslå ordern", href: `${APP_URL}/api/attest?token=${attest_token}&action=reject` },
      }),
      text: `Order #${order!.ticket} från ${who}, ${kr(total)}. Godkänn: ${APP_URL}/api/attest?token=${attest_token}&action=approve`,
    });
  } else if (tenant.contact_email) {
    await resend.emails.send({
      from: process.env.RESEND_FROM || "OA Personalshop <shop@oasystems.se>",
      to: tenant.contact_email,
      replyTo: staff.email,
      subject: `[Order #${order!.ticket}] ${tenant.name} — ${who}`,
      html: renderEmail({
        brand, eyebrow: "Ny beställning", title: tenant.name, badge: `Order #${order!.ticket}`,
        bodyHtml: sectionLabel("Beställare") + infoBox(who) +
          (body.note ? sectionLabel("Meddelande") + infoBox(body.note) : "") +
          sectionLabel("Innehåll") + orderTable(items) +
          `<p style="margin:12px 0 0;font-size:15px;font-weight:700;text-align:right;">Totalt: ${kr(total)}</p>`,
      }),
      text: `Order #${order!.ticket} från ${who}. Totalt ${kr(total)}.`,
    });
  }

  return Response.json({ ok: true, ticket: order!.ticket, status });
}
