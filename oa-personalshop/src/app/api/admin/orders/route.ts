import { db, requireAdmin } from "@/lib/core";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!requireAdmin(req)) return Response.json({ error: "Obehörig" }, { status: 401 });
  const tenantId = new URL(req.url).searchParams.get("tenantId");
  const { data: orders } = await db.from("orders")
    .select("id, ticket, status, total, cost_center, note, created_at, staff_id")
    .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(100);
  const staffIds = [...new Set((orders || []).map((o) => o.staff_id))];
  const { data: staff } = staffIds.length
    ? await db.from("staff").select("id, name, email").in("id", staffIds)
    : { data: [] as any[] };
  const orderIds = (orders || []).map((o) => o.id);
  const { data: items } = orderIds.length
    ? await db.from("order_items").select("order_id, product_name, size, qty").in("order_id", orderIds)
    : { data: [] as any[] };
  return Response.json({
    orders: (orders || []).map((o) => ({
      ...o,
      who: (() => { const s = (staff || []).find((x) => x.id === o.staff_id); return s ? (s.name || s.email) : "-"; })(),
      items: (items || []).filter((i) => i.order_id === o.id)
        .map((i) => i.product_name + (i.size ? " (" + i.size + ")" : "") + " ×" + i.qty),
    })),
  });
}

// PATCH { id, status } — t.ex. markera "ready" (klar att hämta)
export async function PATCH(req: Request) {
  if (!requireAdmin(req)) return Response.json({ error: "Obehörig" }, { status: 401 });
  const { id, status } = await req.json();
  if (!["processing", "ready", "rejected"].includes(status)) return Response.json({ error: "Ogiltig status" }, { status: 400 });
  await db.from("orders").update({ status }).eq("id", id);
  return Response.json({ ok: true });
}
