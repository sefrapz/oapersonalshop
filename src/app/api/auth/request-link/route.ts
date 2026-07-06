import { Resend } from "resend";
import { db, token, APP_URL, renderEmail, infoBox } from "@/lib/core";

export const runtime = "nodejs";
const resend = new Resend(process.env.RESEND_API_KEY!);

// POST { slug, email } — skickar magic link om adressen finns i kundens personallista
export async function POST(req: Request) {
  const { slug, email } = await req.json();
  if (!slug || !email) return Response.json({ error: "Uppgifter saknas" }, { status: 400 });

  if (!process.env.RESEND_API_KEY) console.error("MAGICLINK: RESEND_API_KEY saknas i miljön!");
  if (!process.env.RESEND_FROM) console.error("MAGICLINK: RESEND_FROM saknas i miljön!");

  const { data: tenant } = await db.from("tenants").select("*").eq("slug", slug).eq("active", true).maybeSingle();
  if (!tenant) return Response.json({ error: "Butiken hittades inte" }, { status: 404 });

  const { data: staff } = await db.from("staff").select("*")
    .eq("tenant_id", tenant.id).ilike("email", email.trim()).maybeSingle();

  if (!staff) {
    console.error("MAGICLINK: ingen träff i staff för [" + email.trim() + "] på tenant " + tenant.slug);
  }

  // Svara alltid likadant utåt — läck inte vilka adresser som finns
  if (staff) {
    const t = token();
    await db.from("login_tokens").insert({
      token: t, tenant_id: tenant.id, staff_id: staff.id,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    const link = `${APP_URL}/api/auth/verify?token=${t}`;
    const { data: sent, error } = await resend.emails.send({
      from: process.env.RESEND_FROM || "OA Personalshop <shop@oasystems.se>",
      to: staff.email,
      subject: `Din inloggningslänk — ${tenant.name} personalshop`,
      html: renderEmail({
        brand: { companyName: tenant.name, color: tenant.brand_color, footerLines: tenant.footer_lines },
        eyebrow: "Inloggning", title: tenant.name + " personalshop",
        preheader: "Länken gäller i 15 minuter",
        bodyHtml: infoBox("Hej" + (staff.name ? " " + staff.name : "") + "! Klicka på knappen för att logga in. Länken gäller i 15 minuter och kan bara användas en gång."),
        cta: { label: "Logga in i personalshoppen", href: link },
      }),
      text: `Logga in: ${link} (gäller 15 min)`,
    });
    if (error) {
      console.error("MAGICLINK RESEND ERROR:", JSON.stringify(error));
    } else {
      console.log("MAGICLINK: skickad till " + staff.email + " (id: " + (sent?.id || "?") + ")");
    }
  }
  return Response.json({ ok: true });
}
