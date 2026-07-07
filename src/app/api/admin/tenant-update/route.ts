import { db, requireAdmin } from "@/lib/core";

export const runtime = "nodejs";

// POST { id, ...fält } — snabbuppdatering från dashboard/utseende (whitelist)
export async function POST(req: Request) {
  if (!requireAdmin(req)) return Response.json({ error: "Obehörig" }, { status: 401 });
  const b = await req.json();
  if (!b.id) return Response.json({ error: "id krävs" }, { status: 400 });
  const patch: any = {};
  if (typeof b.brand_color === "string" && /^#[0-9a-fA-F]{6}$/.test(b.brand_color)) patch.brand_color = b.brand_color;
  if (b.radius !== undefined) patch.radius = Math.min(32, Math.max(4, parseInt(b.radius) || 20));
  if (["free", "attest", "quota"].includes(b.order_model)) patch.order_model = b.order_model;
  if (typeof b.welcome_text === "string") patch.welcome_text = b.welcome_text.slice(0, 200);
  if (Object.keys(patch).length === 0) return Response.json({ error: "Inga giltiga fält" }, { status: 400 });
  const { data, error } = await db.from("tenants").update(patch).eq("id", b.id).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ tenant: data });
}
