import { db, sessionCookie } from "@/lib/core";

export const runtime = "nodejs";

// POST — loggar ut: raderar sessionen och nollar cookien (revision H3)
export async function POST(req: Request) {
  const t = sessionCookie(req);
  if (t) await db.from("sessions").delete().eq("token", t);
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": "ps_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  });
}
