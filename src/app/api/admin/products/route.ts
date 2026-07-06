import { db, requireAdmin } from "@/lib/core";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!requireAdmin(req)) return Response.json({ error: "Obehörig" }, { status: 401 });
  const tenantId = new URL(req.url).searchParams.get("tenantId");
  const { data } = await db.from("products").select("*").eq("tenant_id", tenantId).order("sort").order("name");
  return Response.json({ products: data || [] });
}

export async function POST(req: Request) {
  if (!requireAdmin(req)) return Response.json({ error: "Obehörig" }, { status: 401 });
  const b = await req.json();
  const row: any = {
    tenant_id: b.tenantId, name: b.name, category: b.category || "Profil",
    price: Math.max(0, parseInt(b.price) || 0),
    sizes: String(b.sizes || "").split(",").map((s: string) => s.trim()).filter(Boolean),
    image_url: b.image_url || "", color: b.color || "#334155",
    active: b.active !== false, sort: parseInt(b.sort) || 100,
  };
  if (!row.tenant_id || !row.name) return Response.json({ error: "tenantId och namn krävs" }, { status: 400 });
  const q = b.id
    ? db.from("products").update(row).eq("id", b.id).select("*").single()
    : db.from("products").insert(row).select("*").single();
  const { data, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ product: data });
}

export async function DELETE(req: Request) {
  if (!requireAdmin(req)) return Response.json({ error: "Obehörig" }, { status: 401 });
  const { id } = await req.json();
  await db.from("products").delete().eq("id", id);
  return Response.json({ ok: true });
}
