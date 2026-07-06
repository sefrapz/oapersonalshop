import { db, currentStaff, quotaLeft } from "@/lib/core";

export const runtime = "nodejs";

// GET ?slug=... — publik branding + (om inloggad) profil, sortiment och kvot
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug") || "";
  const { data: tenant } = await db.from("tenants").select("*").eq("slug", slug).eq("active", true).maybeSingle();
  if (!tenant) return Response.json({ error: "Butiken hittades inte" }, { status: 404 });

  const pub = {
    name: tenant.name, logo_url: tenant.logo_url, brand_color: tenant.brand_color,
    welcome_text: tenant.welcome_text, order_model: tenant.order_model,
  };

  const me = await currentStaff(req);
  if (!me || me.tenant.id !== tenant.id) return Response.json({ tenant: pub, loggedIn: false });

  const { data: products } = await db.from("products").select("*")
    .eq("tenant_id", tenant.id).eq("active", true).order("sort").order("name");
  const q = quotaLeft(tenant, me.staff);

  return Response.json({
    tenant: { ...pub, attest_threshold: tenant.attest_threshold, quota_type: tenant.quota_type, quota_value: tenant.quota_value },
    loggedIn: true,
    me: { name: me.staff.name, email: me.staff.email },
    quota: tenant.order_model === "quota" ? { left: q.left, unit: q.unit, total: tenant.quota_value } : null,
    products: products || [],
  });
}
