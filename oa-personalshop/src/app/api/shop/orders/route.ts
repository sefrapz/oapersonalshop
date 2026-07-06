import { db, currentStaff } from "@/lib/core";

export const runtime = "nodejs";

// GET — den inloggades egna ordrar med rader
export async function GET(req: Request) {
  const me = await currentStaff(req);
  if (!me) return Response.json({ error: "Inte inloggad" }, { status: 401 });

  const { data: orders } = await db.from("orders")
    .select("id, ticket, status, total, created_at")
    .eq("tenant_id", me.tenant.id).eq("staff_id", me.staff.id)
    .order("created_at", { ascending: false }).limit(20);

  const ids = (orders || []).map((o) => o.id);
  const { data: items } = ids.length
    ? await db.from("order_items").select("order_id, product_name, size, qty").in("order_id", ids)
    : { data: [] as any[] };

  return Response.json({
    orders: (orders || []).map((o) => ({
      ...o,
      items: (items || []).filter((i) => i.order_id === o.id)
        .map((i) => i.product_name + (i.size ? " (" + i.size + ")" : "") + " ×" + i.qty),
    })),
  });
}
