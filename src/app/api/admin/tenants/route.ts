import { db, requireAdmin } from "@/lib/core";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!requireAdmin(req)) return Response.json({ error: "Obehörig" }, { status: 401 });
  const { data } = await db.from("tenants").select("*").order("created_at");
  return Response.json({ tenants: data || [] });
}

// POST — skapa eller uppdatera (skicka med id för uppdatering). ALLT är inställningar.
export async function POST(req: Request) {
  if (!requireAdmin(req)) return Response.json({ error: "Obehörig" }, { status: 401 });
  const b = await req.json();
  const row: any = {
    slug: String(b.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, ""),
    name: b.name, logo_url: b.logo_url || "", brand_color: b.brand_color || "#7e22ce",
    welcome_text: b.welcome_text || "Välkommen till er personalshop!",
    order_model: ["free", "attest", "quota"].includes(b.order_model) ? b.order_model : "attest",
    attest_threshold: Math.max(0, parseInt(b.attest_threshold) || 0),
    quota_type: b.quota_type === "items" ? "items" : "kr",
    quota_value: Math.max(0, parseInt(b.quota_value) || 0),
    approver_email: b.approver_email || "", contact_email: b.contact_email || "",
    footer_lines: Array.isArray(b.footer_lines) ? b.footer_lines : String(b.footer_lines || "").split("\n").filter(Boolean),
    active: b.active !== false,
  };
  if (!row.slug || !row.name) return Response.json({ error: "slug och namn krävs" }, { status: 400 });

  const q = b.id
    ? db.from("tenants").update(row).eq("id", b.id).select("*").single()
    : db.from("tenants").insert(row).select("*").single();
  const { data, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ tenant: data });
}
