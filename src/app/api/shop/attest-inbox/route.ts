import { db, currentStaff, quotaLeft } from "@/lib/core";

export const runtime = "nodejs";

// GET — chefens attestkorg (kräver inloggad session med role=manager)
export async function GET(req: Request) {
  const me = await currentStaff(req);
  if (!me) return Response.json({ error: "Inte inloggad" }, { status: 401 });
  if ((me.staff.role || "employee") !== "manager") return Response.json({ error: "Endast chefer" }, { status: 403 });

  const { data: orders } = await db.from("orders")
    .select("id, ticket, total, note, created_at, staff_id")
    .eq("tenant_id", me.tenant.id).eq("status", "pending_attest")
    .order("created_at", { ascending: true }).limit(50);

  const ids = (orders || []).map((o) => o.id);
  const { data: items } = ids.length
    ? await db.from("order_items").select("order_id, product_name, size, qty").in("order_id", ids)
    : { data: [] as any[] };
  const staffIds = Array.from(new Set((orders || []).map((o) => o.staff_id)));
  const { data: who } = staffIds.length
    ? await db.from("staff").select("id, name, email").in("id", staffIds)
    : { data: [] as any[] };
  const whoMap = Object.fromEntries((who || []).map((s) => [s.id, s.name || s.email]));

  // Teamets kvotläge (endast kvotmodell)
  let team: any[] = [];
  if (me.tenant.order_model === "quota") {
    const { data: all } = await db.from("staff")
      .select("name, email, used_kr, used_items").eq("tenant_id", me.tenant.id)
      .order("used_kr", { ascending: false }).limit(12);
    team = (all || []).map((s) => ({
      name: s.name || s.email,
      used: me.tenant.quota_type === "items" ? s.used_items : s.used_kr,
      max: me.tenant.quota_value,
      unit: me.tenant.quota_type === "items" ? "plagg" : "kr",
    }));
  }

  return Response.json({
    pending: (orders || []).map((o) => ({
      id: o.id, ticket: o.ticket, total: o.total, note: o.note, created_at: o.created_at,
      who: whoMap[o.staff_id] || "—",
      items: (items || []).filter((i) => i.order_id === o.id)
        .map((i) => `${i.product_name}${i.size ? " (" + i.size + ")" : ""} ×${i.qty}`),
    })),
    team,
  });
}
