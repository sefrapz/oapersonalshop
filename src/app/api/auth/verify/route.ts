import { db, token } from "@/lib/core";

export const runtime = "nodejs";

// GET ?token=... — verifierar magic link, sätter sessionscookie, skickar till butiken
export async function GET(req: Request) {
  const url = new URL(req.url);
  const t = url.searchParams.get("token") || "";
  const { data: lt } = await db.from("login_tokens").select("*").eq("token", t).maybeSingle();

  if (!lt || lt.used || new Date(lt.expires_at) < new Date()) {
    return new Response("Länken är ogiltig eller har gått ut. Be om en ny i butiken.", {
      status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  await db.from("login_tokens").update({ used: true }).eq("token", t);

  const s = token();
  await db.from("sessions").insert({
    token: s, tenant_id: lt.tenant_id, staff_id: lt.staff_id,
    expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  });
  const { data: tenant } = await db.from("tenants").select("slug").eq("id", lt.tenant_id).single();

  return new Response(null, {
    status: 302,
    headers: {
      Location: `/s/${tenant!.slug}`,
      "Set-Cookie": `ps_session=${s}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 3600}`,
    },
  });
}
