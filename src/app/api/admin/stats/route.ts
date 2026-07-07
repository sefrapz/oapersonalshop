import { db, requireAdmin } from "@/lib/core";

export const runtime = "nodejs";

// GET ?tenantId= — dashboarddata beräknad ur riktiga ordrar (senaste 84 dagarna)
export async function GET(req: Request) {
  if (!requireAdmin(req)) return Response.json({ error: "Obehörig" }, { status: 401 });
  const tenantId = new URL(req.url).searchParams.get("tenantId") || "";
  if (!tenantId) return Response.json({ error: "tenantId krävs" }, { status: 400 });

  const since = new Date(Date.now() - 84 * 86400000).toISOString();
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const [{ data: orders }, { data: staff }, { data: tenant }] = await Promise.all([
    db.from("orders").select("id, ticket, status, total, created_at, staff_id")
      .eq("tenant_id", tenantId).gte("created_at", since)
      .order("created_at", { ascending: false }).limit(500),
    db.from("staff").select("id, name, email, used_kr, used_items").eq("tenant_id", tenantId),
    db.from("tenants").select("order_model, quota_type, quota_value").eq("id", tenantId).single(),
  ]);
  const os = orders || [], st = staff || [];

  // 12 veckostaplar
  const weeks = Array.from({ length: 12 }, () => 0);
  for (const o of os) {
    const age = Math.floor((Date.now() - new Date(o.created_at).getTime()) / (7 * 86400000));
    if (age >= 0 && age < 12) weeks[11 - age]++;
  }
  const monthOrders = os.filter((o) => new Date(o.created_at) >= monthStart);
  const pending = os.filter((o) => o.status === "pending_attest").length;
  const activeStaffIds = new Set(os.map((o) => o.staff_id));

  // Topprodukter & storlekar ur order_items
  const ids = os.slice(0, 300).map((o) => o.id);
  const { data: items } = ids.length
    ? await db.from("order_items").select("order_id, product_name, size, qty").in("order_id", ids)
    : { data: [] as any[] };
  const topMap: Record<string, number> = {}, sizeMap: Record<string, number> = {};
  for (const i of items || []) {
    topMap[i.product_name] = (topMap[i.product_name] || 0) + i.qty;
    if (i.size) sizeMap[i.size] = (sizeMap[i.size] || 0) + i.qty;
  }
  const top = Object.entries(topMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const totalSized = Object.values(sizeMap).reduce((s, n) => s + n, 0) || 1;
  const sizes = Object.entries(sizeMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([s, n]) => [s, Math.round((n / totalSized) * 100)]);

  // Budget (kvotmodell): förbrukat / total pott
  let budgetPct: number | null = null;
  if (tenant?.order_model === "quota" && st.length) {
    const used = st.reduce((s, x) => s + (tenant.quota_type === "items" ? x.used_items : x.used_kr), 0);
    budgetPct = Math.min(100, Math.round((used / (tenant.quota_value * st.length)) * 100));
  }

  const whoMap = Object.fromEntries(st.map((s) => [s.id, s.name || s.email]));
  const badge: Record<string, string> = { processing: "Behandlas", ready: "Klar", pending_attest: "Väntar attest", rejected: "Avslagen" };

  return Response.json({
    kpi: {
      activeStaff: activeStaffIds.size, totalStaff: st.length,
      monthOrders: monthOrders.length, monthValue: monthOrders.reduce((s, o) => s + o.total, 0),
      pending, budgetPct,
    },
    weeks, top, sizes,
    activity: os.slice(0, 8).map((o) => ({
      ticket: o.ticket, who: whoMap[o.staff_id] || "—", total: o.total,
      status: badge[o.status] || o.status, when: o.created_at,
    })),
  });
}
