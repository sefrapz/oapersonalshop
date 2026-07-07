import { db, requireAdmin } from "@/lib/core";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!requireAdmin(req)) return Response.json({ error: "Obehörig" }, { status: 401 });
  const tenantId = new URL(req.url).searchParams.get("tenantId");
  const { data } = await db.from("staff").select("*").eq("tenant_id", tenantId).order("email");
  return Response.json({ staff: data || [] });
}

// POST { tenantId, list } — klistra in "namn <epost>" eller bara epost, en per rad
export async function POST(req: Request) {
  if (!requireAdmin(req)) return Response.json({ error: "Obehörig" }, { status: 401 });
  const { tenantId, list } = await req.json();
  if (!tenantId || !list) return Response.json({ error: "tenantId och lista krävs" }, { status: 400 });

  const rows: any[] = [];
  for (const raw of String(list).split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(.*?)[<,;\s]*([^\s<>,;]+@[^\s<>,;]+)>?$/);
    if (!m) continue;
    rows.push({ tenant_id: tenantId, email: m[2].toLowerCase(), name: m[1].replace(/[<>,;]/g, "").trim() });
  }
  if (!rows.length) return Response.json({ error: "Inga giltiga adresser hittades" }, { status: 400 });

  const { error } = await db.from("staff").upsert(rows, { onConflict: "tenant_id,email" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, added: rows.length });
}

export async function DELETE(req: Request) {
  if (!requireAdmin(req)) return Response.json({ error: "Obehörig" }, { status: 401 });
  const { id } = await req.json();
  await db.from("staff").delete().eq("id", id);
  return Response.json({ ok: true });
}

// PATCH { id, role } — växla anställd/chef (chef ser attestkorgen i butiken)
export async function PATCH(req: Request) {
  if (!requireAdmin(req)) return Response.json({ error: "Obehörig" }, { status: 401 });
  const b = await req.json();
  const role = b.role === "manager" ? "manager" : "employee";
  if (!b.id) return Response.json({ error: "id krävs" }, { status: 400 });
  const { error } = await db.from("staff").update({ role }).eq("id", b.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, role });
}
