import { db, currentStaff } from "@/lib/core";
import { decideOrder } from "@/lib/attest";

export const runtime = "nodejs";

// POST { orderId, action: "approve"|"reject" } — beslut från chefens attestkorg
export async function POST(req: Request) {
  const me = await currentStaff(req);
  if (!me) return Response.json({ error: "Inte inloggad" }, { status: 401 });
  if ((me.staff.role || "employee") !== "manager") return Response.json({ error: "Endast chefer" }, { status: 403 });

  const body = await req.json();
  const action = body.action === "reject" ? "rejected" : "approved";
  const { data: order } = await db.from("orders").select("*")
    .eq("id", String(body.orderId || "")).eq("tenant_id", me.tenant.id).maybeSingle();
  if (!order) return Response.json({ error: "Ordern hittades inte" }, { status: 404 });
  if (order.status !== "pending_attest") return Response.json({ error: "Redan hanterad" }, { status: 409 });

  const r = await decideOrder(order, action as any, me.staff.name || me.staff.email);
  return Response.json({ ok: true, ...r });
}
