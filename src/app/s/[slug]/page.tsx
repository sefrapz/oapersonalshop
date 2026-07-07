"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

// OA Personalshop — butiken (v3 "demo-pariteten"):
// samma design & funktioner som säljdemon, men allt mot riktig data.
// Kontrakt: /api/shop/config · order · orders · assistant · attest-inbox · attest-decide

const kr = (n: number) => new Intl.NumberFormat("sv-SE").format(n) + " kr";
const GLASS = "bg-white/[0.05] border border-white/10 backdrop-blur-xl";
const STEPS = ["Beställd", "Attest", "Tryck", "Klar"];

// ===== CSS-plagg (samma recept som säljdemon; image_url vinner om den finns) =====
function GarmentArt({ p, className = "" }: { p: any; className?: string }) {
  if (p.image_url) {
    return <div className={"rounded-2xl overflow-hidden " + className} style={{ background: `url(${p.image_url}) center/cover` }} />;
  }
  const tint = p.color || "#3a3a3c";
  const shapes: Record<string, React.ReactNode> = {
    jacket: (<><div className="absolute inset-x-[18%] top-[14%] bottom-[16%] rounded-[14px]" style={{ background: "linear-gradient(160deg, rgba(255,255,255,.28), rgba(0,0,0,.25))" }} /><div className="absolute left-1/2 top-[14%] bottom-[16%] w-[3px] -translate-x-1/2 bg-black/30" /><div className="absolute inset-x-[6%] top-[16%] h-[26%]" style={{ borderRadius: "12px 12px 40% 40%", background: "rgba(255,255,255,.10)" }} /></>),
    hoodie: (<><div className="absolute inset-x-[18%] top-[20%] bottom-[14%] rounded-[14px]" style={{ background: "linear-gradient(160deg, rgba(255,255,255,.25), rgba(0,0,0,.22))" }} /><div className="absolute left-1/2 top-[8%] w-[46%] h-[24%] -translate-x-1/2 rounded-full" style={{ background: "rgba(255,255,255,.14)" }} /><div className="absolute left-1/2 top-[44%] w-[34%] h-[16%] -translate-x-1/2 rounded-[8px] bg-black/20" /></>),
    tee: (<><div className="absolute inset-x-[20%] top-[20%] bottom-[20%] rounded-[12px]" style={{ background: "linear-gradient(160deg, rgba(255,255,255,.26), rgba(0,0,0,.2))" }} /><div className="absolute top-[20%] left-[8%] w-[22%] h-[16%] rounded-[8px]" style={{ background: "rgba(255,255,255,.16)" }} /><div className="absolute top-[20%] right-[8%] w-[22%] h-[16%] rounded-[8px]" style={{ background: "rgba(255,255,255,.16)" }} /></>),
    pants: (<><div className="absolute top-[12%] bottom-[10%] left-[30%] w-[16%] rounded-[10px]" style={{ background: "linear-gradient(160deg, rgba(255,255,255,.24), rgba(0,0,0,.22))" }} /><div className="absolute top-[12%] bottom-[10%] right-[30%] w-[16%] rounded-[10px]" style={{ background: "linear-gradient(160deg, rgba(255,255,255,.18), rgba(0,0,0,.26))" }} /><div className="absolute top-[12%] inset-x-[30%] h-[14%] rounded-[8px]" style={{ background: "rgba(255,255,255,.2)" }} /></>),
    beanie: (<><div className="absolute left-1/2 top-[24%] w-[56%] h-[44%] -translate-x-1/2" style={{ borderRadius: "50% 50% 14px 14px", background: "linear-gradient(160deg, rgba(255,255,255,.3), rgba(0,0,0,.2))" }} /><div className="absolute left-1/2 top-[58%] w-[62%] h-[14%] -translate-x-1/2 rounded-[8px]" style={{ background: "rgba(255,255,255,.18)" }} /></>),
    vest: (<><div className="absolute inset-x-[24%] top-[14%] bottom-[18%] rounded-[14px]" style={{ background: "linear-gradient(160deg, rgba(255,255,255,.26), rgba(0,0,0,.24))" }} /><div className="absolute left-1/2 top-[14%] bottom-[18%] w-[3px] -translate-x-1/2 bg-black/30" /><div className="absolute inset-x-[28%] top-[26%] h-[8%] rounded-full" style={{ background: "rgba(255,215,0,.35)" }} /><div className="absolute inset-x-[28%] top-[44%] h-[8%] rounded-full" style={{ background: "rgba(255,215,0,.35)" }} /></>),
  };
  return (
    <div className={"relative rounded-2xl overflow-hidden " + className} style={{ background: `linear-gradient(150deg, ${tint}, #10141c)` }}>
      {shapes[p.shape] || shapes.tee}
      <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.14), transparent 55%)" }} />
    </div>
  );
}

export default function Shop() {
  const { slug } = useParams<{ slug: string }>();
  const [cfg, setCfg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [loginMsg, setLoginMsg] = useState("");
  const [view, setView] = useState<"shop" | "attest">("shop");
  const [orders, setOrders] = useState<any[]>([]);
  const [inbox, setInbox] = useState<any>({ pending: [], team: [] });
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg] = useState("");
  // ordermodal
  const [mP, setMP] = useState<any>(null);
  const [mSize, setMSize] = useState("");
  const [mQty, setMQty] = useState(1);
  const [placing, setPlacing] = useState(false);
  // AI
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMsgs, setAiMsgs] = useState<{ role: string; text: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [filter, setFilter] = useState("");

  const t = cfg?.tenant;
  const brand = t?.brand_color || "#7e22ce";
  const radius = (t?.radius ?? 20) + "px";
  const isManager = cfg?.me?.role === "manager";
  const model = t?.order_model;

  function toast(m: string) { setToastMsg(m); setTimeout(() => setToastMsg(""), 3000); }

  async function loadConfig() {
    const j = await fetch(`/api/shop/config?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
    setCfg(j); setLoading(false);
    if (j.loggedIn) loadOrders();
  }
  async function loadOrders() {
    const j = await fetch("/api/shop/orders").then((r) => r.json());
    setOrders(j.orders || []);
  }
  async function loadInbox() {
    const j = await fetch("/api/shop/attest-inbox").then((r) => r.json());
    if (!j.error) setInbox(j);
  }
  useEffect(() => { loadConfig(); }, [slug]);
  useEffect(() => {
    try { const f = JSON.parse(localStorage.getItem("ps_favs_" + slug) || "[]"); setFavs(new Set(f)); } catch {}
  }, [slug]);
  useEffect(() => { if (cfg?.loggedIn && isManager) loadInbox(); }, [cfg?.loggedIn, isManager]);

  function toggleFav(id: string) {
    setFavs((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      try { localStorage.setItem("ps_favs_" + slug, JSON.stringify(Array.from(n))); } catch {}
      return n;
    });
  }

  async function requestLink() {
    if (!email.includes("@")) { setLoginMsg("Ange din jobbmejl."); return; }
    setLoginMsg("Skickar…");
    await fetch("/api/auth/request-link", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, email }),
    });
    setLoginMsg("Kolla din inkorg — inloggningslänken gäller i 15 minuter. ✉️");
  }

  const products = cfg?.products || [];
  const shown = useMemo(() => {
    if (!filter) return products;
    const f = filter.toLowerCase();
    return products.filter((p: any) => (p.name + " " + p.category).toLowerCase().includes(f));
  }, [products, filter]);

  const quota = cfg?.quota; // { left, unit, total } | null
  const quotaPct = quota ? Math.max(0, Math.min(1, quota.left / quota.total)) : 0;

  function openModal(p: any) {
    setMP(p); setMSize(p.sizes?.[Math.min(2, (p.sizes?.length || 1) - 1)] || ""); setMQty(1);
  }
  async function placeOrder() {
    if (placing || !mP) return;
    // Klientkoll (servern är sanningen — atomär kvot sedan revisionen)
    if (quota) {
      const need = quota.unit === "plagg" ? mQty : mP.price * mQty;
      if (need > quota.left) {
        setMP(null);
        toast(`Kvoten räcker inte — ${quota.left} ${quota.unit} kvar. Prata med din chef om påfyllnad.`);
        return;
      }
    }
    setPlacing(true);
    const j = await fetch("/api/shop/order", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ productId: mP.id, size: mSize || undefined, qty: mQty }] }),
    }).then((r) => r.json());
    setPlacing(false); setMP(null);
    if (j.error) { toast(j.error); return; }
    toast(j.status === "pending_attest"
      ? `Order #${j.ticket} skickad för attest ✓ — du meddelas via mejl`
      : `Order #${j.ticket} lagd ✓ — direkt till behandling`);
    loadConfig(); loadOrders();
  }

  async function decide(orderId: string, ok: boolean) {
    const el = document.getElementById("attest-" + orderId);
    if (el) { el.style.transition = "all .45s cubic-bezier(.16,1,.3,1)"; el.style.opacity = "0"; el.style.transform = "translateX(28px)"; }
    const j = await fetch("/api/shop/attest-decide", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, action: ok ? "approve" : "reject" }),
    }).then((r) => r.json());
    if (j.error) { toast(j.error); if (el) { el.style.opacity = "1"; el.style.transform = "none"; } loadInbox(); return; }
    toast(`Order #${j.ticket} ${ok ? "godkänd" : "nekad"} — beställaren har meddelats ✓`);
    setTimeout(() => { loadInbox(); loadOrders(); }, 420);
  }

  async function sendAI(q?: string) {
    const msg = (q ?? aiInput).trim();
    if (!msg || aiBusy) return;
    setAiInput(""); setAiOpen(true); setAiBusy(true);
    setAiMsgs((m) => [...m, { role: "user", text: msg }]);
    // klientside-magi som i demon: nyckelord filtrerar sortimentet direkt
    if (/vinter/i.test(msg)) setFilter("jack");
    const j = await fetch("/api/shop/assistant", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg }),
    }).then((r) => r.json()).catch(() => ({ reply: "Något gick fel — prova igen." }));
    setAiMsgs((m) => [...m, { role: "ai", text: j.reply || j.error || "…" }]);
    setAiBusy(false);
  }

  // ===== Statusmappning för tidslinjen (riktiga statusar, inget låtsat) =====
  function stepState(o: any) {
    const skipAttest = model !== "attest" && o.status !== "pending_attest";
    if (o.status === "rejected") return { done: 0, waiting: -1, rejected: true, skipAttest };
    if (o.status === "pending_attest") return { done: 0, waiting: 1, rejected: false, skipAttest: false };
    if (o.status === "processing") return { done: 2, waiting: -1, rejected: false, skipAttest };
    if (o.status === "ready") return { done: 3, waiting: -1, rejected: false, skipAttest };
    return { done: 0, waiting: -1, rejected: false, skipAttest };
  }

  // ================= RENDER =================
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-white/40 text-[14px]" style={{ background: "#0b0e13" }}>Laddar butiken…</div>
  );
  if (!t) return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center text-white" style={{ background: "#0b0e13" }}>
      <div><h1 className="grotesk text-[26px] font-semibold">Butiken hittades inte</h1>
      <p className="text-white/45 text-[13.5px] mt-2">Kontrollera adressen — eller kontakta er butiksansvarige.</p></div>
    </div>
  );

  const initials = (t.name || "AB").split(/\s+/).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const vars: any = { "--brand": brand, "--radius": radius };

  // ===== Utloggat läge: inloggning =====
  if (!cfg.loggedIn) return (
    <div className="min-h-screen relative overflow-hidden text-white" style={vars}>
      <div className="fixed inset-0 -z-10" style={{ background: "#0b0e13" }} />
      <div className="fixed w-[520px] h-[520px] rounded-full blur-[110px] opacity-[0.16] -top-40 -left-32 pointer-events-none" style={{ background: brand }} />
      <div className="relative z-10 min-h-screen flex items-center justify-center px-5">
        <div className={GLASS + " w-full max-w-[400px] p-8"} style={{ borderRadius: "calc(var(--radius) + 8px)" }}>
          <div className="flex items-center gap-3 mb-6">
            {t.logo_url
              ? <img src={t.logo_url} alt="" className="w-11 h-11 rounded-xl object-cover" />
              : <div className="w-11 h-11 rounded-xl flex items-center justify-center grotesk font-bold text-[15px] text-[#0b0e13]" style={{ background: brand }}>{initials}</div>}
            <div>
              <p className="grotesk font-semibold text-[17px] leading-tight">{t.name}</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/35 font-semibold">Personalshop</p>
            </div>
          </div>
          <h1 className="grotesk text-[22px] font-semibold mb-1.5">Logga in</h1>
          <p className="text-[13px] text-white/45 mb-5 font-light">Ange din jobbmejl så skickar vi en inloggningslänk — inga lösenord.</p>
          <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && requestLink()}
            placeholder="fornamn@foretaget.se" type="email"
            className="w-full bg-white/[0.06] border border-white/15 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:border-white/40 mb-3" />
          <button onClick={requestLink} className="w-full rounded-full py-3.5 text-[13.5px] font-bold text-[#0b0e13] hover:opacity-90 transition-opacity" style={{ background: brand }}>
            Skicka inloggningslänk
          </button>
          {loginMsg && <p className="text-[12.5px] text-white/60 mt-3 text-center">{loginMsg}</p>}
          <p className="text-[10.5px] text-white/25 mt-6 text-center">Drivs av OA Personalshop · oasystems.se</p>
        </div>
      </div>
    </div>
  );

  // ===== Inloggat läge =====
  const firstName = (cfg.me.name || cfg.me.email).split(/[\s@]/)[0];
  const hour = new Date().getHours();
  const greet = hour < 10 ? "God morgon" : hour < 18 ? "Hej" : "God kväll";
  const modelHint = model === "free"
    ? "Fri beställning — det du behöver skickas direkt till behandling."
    : model === "attest"
      ? `Attestmodell — ordrar${t.attest_threshold > 0 ? " över " + kr(t.attest_threshold) : ""} godkänns av chef med ett klick. Du meddelas direkt.`
      : "Kvotmodell — du har en egen årspott. Systemet räknar automatiskt.";

  return (
    <div className="min-h-screen relative text-white" style={vars}>
      <div className="fixed inset-0 -z-10" style={{ background: "#0b0e13" }} />
      <div className="fixed w-[520px] h-[520px] rounded-full blur-[110px] opacity-[0.14] -top-40 -left-32 pointer-events-none" style={{ background: brand }} />
      <div className="fixed w-[420px] h-[420px] rounded-full blur-[110px] opacity-[0.10] top-1/2 -right-32 pointer-events-none" style={{ background: brand }} />

      <div className="relative z-10 max-w-[1100px] mx-auto px-4 sm:px-6 pb-28 pt-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            {t.logo_url
              ? <img src={t.logo_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
              : <div className="w-10 h-10 rounded-xl flex items-center justify-center grotesk font-bold text-[14px] text-[#0b0e13]" style={{ background: brand }}>{initials}</div>}
            <div>
              <p className="grotesk font-semibold text-[15.5px] leading-tight">{t.name}</p>
              <p className="text-[9.5px] uppercase tracking-[0.2em] text-white/35 font-semibold">Personalshop</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isManager && (
              <button onClick={() => { setView(view === "attest" ? "shop" : "attest"); loadInbox(); }}
                className={`${GLASS} relative rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors ${view === "attest" ? "text-[#0b0e13]" : "hover:bg-white/10"}`}
                style={view === "attest" ? { background: brand, borderColor: brand } : {}}>
                ✅ Attest
                {inbox.pending.length > 0 && <span className="absolute -top-1.5 -right-1.5 text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[#0b0e13]" style={{ background: brand }}>{inbox.pending.length}</span>}
              </button>
            )}
            <button onClick={() => { setView("shop"); setTimeout(() => document.getElementById("myorders")?.scrollIntoView({ behavior: "smooth" }), 50); }}
              className={`${GLASS} rounded-full px-4 py-2 text-[12.5px] font-semibold hover:bg-white/10 transition-colors`}>Mina ordrar</button>
            <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); location.reload(); }}
              className={`${GLASS} rounded-full px-4 py-2 text-[12.5px] font-semibold text-white/50 hover:bg-white/10 hover:text-white transition-colors`}>Logga ut</button>
          </div>
        </header>

        {/* ===== Attestvy (chef) ===== */}
        {view === "attest" && isManager && (
          <div className="space-y-5">
            <div className={GLASS + " p-7"} style={{ borderRadius: "calc(var(--radius) + 6px)" }}>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/40 font-bold">Attestkorg</p>
              <h1 className="grotesk text-[26px] font-semibold mt-1">{greet} {firstName} — {inbox.pending.length === 0 ? "allt är attesterat ✨" : inbox.pending.length + " väntar på dig"}</h1>
              <p className="text-[13px] text-white/45 mt-1.5 font-light">Godkänn med ett klick. Beställaren meddelas automatiskt via mejl.</p>
            </div>
            {inbox.pending.map((a: any) => (
              <div key={a.id} id={"attest-" + a.id} className={GLASS + " p-5 flex items-center gap-4 flex-wrap"} style={{ borderRadius: "var(--radius)" }}>
                <div className="flex-1 min-w-[200px]">
                  <p className="grotesk font-semibold text-[15px]">{a.items.join(", ")}</p>
                  <p className="text-[12px] text-white/45 mt-0.5">{a.who}{a.note ? " · ”" + a.note + "”" : ""}</p>
                  <p className="text-[11px] text-white/30 mt-0.5">#{a.ticket} · {new Date(a.created_at).toLocaleDateString("sv-SE")}</p>
                </div>
                <span className="grotesk text-[16px]">{kr(a.total)}</span>
                <div className="flex gap-2">
                  <button onClick={() => decide(a.id, false)} className={GLASS + " rounded-full px-4 py-2.5 text-[12px] font-semibold hover:bg-white/10 transition-colors"}>Neka</button>
                  <button onClick={() => decide(a.id, true)} className="rounded-full px-5 py-2.5 text-[12px] font-bold text-[#0b0e13] hover:opacity-90 transition-opacity" style={{ background: brand }}>Godkänn ✓</button>
                </div>
              </div>
            ))}
            {inbox.team.length > 0 && (
              <div className={GLASS + " p-6"} style={{ borderRadius: "var(--radius)" }}>
                <h2 className="grotesk text-[16px] font-semibold mb-4">Teamets kvot i år</h2>
                <div className="space-y-3.5">
                  {inbox.team.map((m: any) => (
                    <div key={m.name}>
                      <div className="flex justify-between text-[12.5px] mb-1"><span>{m.name}</span><span className="text-white/45">{m.unit === "kr" ? kr(m.used) + " / " + kr(m.max) : m.used + " / " + m.max + " plagg"}</span></div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: Math.min(100, (m.used / m.max) * 100) + "%", background: m.used / m.max > 0.9 ? "#fb7185" : brand }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== Butiksvy ===== */}
        {view === "shop" && (
          <div className="space-y-7">
            <div className="grid lg:grid-cols-[1fr_320px] gap-5">
              <div className={GLASS + " p-7"} style={{ borderRadius: "calc(var(--radius) + 6px)" }}>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/40 font-bold">{new Date().toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}</p>
                <h1 className="grotesk text-[clamp(24px,4vw,34px)] font-semibold mt-1.5">{greet}, {firstName} 👋</h1>
                <p className="text-[13.5px] text-white/50 mt-2 font-light">{t.welcome_text} {modelHint}</p>
                <div className="flex gap-2 mt-5 flex-wrap">
                  <button onClick={() => document.getElementById("sortiment")?.scrollIntoView({ behavior: "smooth" })}
                    className="rounded-full px-5 py-2.5 text-[12.5px] font-bold text-[#0b0e13] hover:opacity-90 transition-opacity" style={{ background: brand }}>Beställ nytt</button>
                  <button onClick={() => sendAI("Vad finns kvar av min kvot?")} className={GLASS + " rounded-full px-5 py-2.5 text-[12.5px] font-semibold hover:bg-white/10 transition-colors"}>✦ Fråga assistenten</button>
                </div>
              </div>
              {quota && (
                <div className={GLASS + " p-6 flex items-center gap-5"} style={{ borderRadius: "calc(var(--radius) + 6px)" }}>
                  <svg width="92" height="92" viewBox="0 0 100 100" className="flex-shrink-0 -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" stroke="rgba(255,255,255,.09)" />
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" strokeLinecap="round" stroke={brand}
                      strokeDasharray="264" strokeDashoffset={264 - 264 * quotaPct} style={{ transition: "stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)" }} />
                  </svg>
                  <div>
                    <p className="text-[10.5px] uppercase tracking-[0.2em] text-white/40 font-bold">Min årskvot</p>
                    <p className="grotesk text-[22px] font-semibold leading-tight">{quota.unit === "kr" ? kr(quota.left) : quota.left + " plagg"} kvar</p>
                    <p className="text-[11.5px] text-white/45 mt-0.5">av {quota.unit === "kr" ? kr(quota.total) : quota.total + " plagg"} i år</p>
                  </div>
                </div>
              )}
            </div>

            {/* Sortiment */}
            <div id="sortiment">
              <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
                <h2 className="grotesk text-[19px] font-semibold">Ert sortiment {filter && <span className="text-white/35 text-[12.5px] font-normal">· filtrerat ✦</span>}</h2>
                {filter && <button onClick={() => setFilter("")} className="text-[12px] text-white/50 underline hover:text-white transition-colors">Visa allt</button>}
              </div>
              {shown.length === 0 && <div className={GLASS + " p-10 text-center text-white/40 text-[13px]"} style={{ borderRadius: "var(--radius)" }}>{products.length === 0 ? "Inga produkter upplagda ännu — hör med er butiksansvarige." : "Inget matchade filtret."}</div>}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {shown.map((p: any) => (
                  <div key={p.id} className={GLASS + " p-4 group hover:bg-white/[0.08] transition-colors"} style={{ borderRadius: "var(--radius)" }}>
                    <div className="relative">
                      <GarmentArt p={p} className="aspect-[4/3] mb-3 group-hover:scale-[1.02] transition-transform duration-500" />
                      <button onClick={() => toggleFav(p.id)} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 backdrop-blur border border-white/10 text-[13px] hover:scale-110 transition-transform">{favs.has(p.id) ? "♥" : "♡"}</button>
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/35 font-bold">{p.category}</p>
                    <p className="grotesk font-semibold text-[14.5px] leading-tight">{p.name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="grotesk text-[13.5px]">{p.price > 0 ? kr(p.price) : quota?.unit === "plagg" ? "1 plagg" : "Ingår"}</span>
                      <button onClick={() => openModal(p)} className="rounded-full px-4 py-1.5 text-[11.5px] font-bold text-[#0b0e13] hover:opacity-90 transition-opacity" style={{ background: brand }}>Beställ</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mina beställningar */}
            <div id="myorders">
              <h2 className="grotesk text-[19px] font-semibold mb-4">Mina beställningar</h2>
              {orders.length === 0 && <p className="text-white/40 text-[13px]">Inga beställningar än — de samlas här.</p>}
              <div className="space-y-3">
                {orders.map((o: any) => {
                  const st = stepState(o);
                  return (
                    <div key={o.ticket} className={GLASS + " p-5"} style={{ borderRadius: "var(--radius)" }}>
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                        <div><span className="grotesk font-semibold text-[14px]">{(o.items || []).join(", ")}</span></div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-white/40">#{o.ticket} · {new Date(o.created_at).toLocaleDateString("sv-SE")}</span>
                          <span className="grotesk text-[13.5px]">{kr(o.total)}</span>
                        </div>
                      </div>
                      {st.rejected ? (
                        <p className="text-[12.5px] text-rose-300">✕ Avslagen av attestansvarig — hör med din chef om du har frågor.</p>
                      ) : (
                        <div className="flex">
                          {STEPS.map((s, i) => {
                            const skip = st.skipAttest && i === 1;
                            const done = !skip && st.done >= i;
                            const waiting = st.waiting === i;
                            return (
                              <div key={s} className={"flex items-center " + (i < STEPS.length - 1 ? "flex-1" : "")}>
                                <div className="flex flex-col items-center">
                                  <span className={"w-6 h-6 rounded-full border text-[10px] flex items-center justify-center font-bold " + (done ? "text-[#0b0e13]" : waiting ? "border-white/40 text-white/70" : "border-white/20 text-white/30") + (skip ? " opacity-25 line-through" : "")}
                                    style={done ? { background: brand, borderColor: brand } : {}}>{done ? "✓" : waiting ? "…" : i + 1}</span>
                                  <span className={"text-[9px] mt-1 " + (done ? "text-white/70" : "text-white/30") + (skip ? " opacity-25" : "")}>{s}{waiting ? " (väntar)" : ""}</span>
                                </div>
                                {i < STEPS.length - 1 && <span className="flex-1 h-px mx-1 mb-3" style={{ background: st.done > i ? brand : "rgba(255,255,255,.12)" }} />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-[10.5px] text-white/25 mt-14">{(t.footer_lines || []).join(" · ") || "Drivs av OA Personalshop"}</p>
      </div>

      {/* ===== AI-assistent ===== */}
      <button onClick={() => setAiOpen(!aiOpen)} className="fixed bottom-5 left-5 z-40 rounded-full pl-4 pr-5 py-3 text-[13px] font-semibold flex items-center gap-2 shadow-2xl border border-white/10 backdrop-blur-xl hover:bg-white/10 transition-colors" style={{ background: "rgba(16,20,28,.85)" }}>
        ✦ <span style={{ color: brand }}>Assistent</span>
      </button>
      {aiOpen && (
        <div className="fixed bottom-20 left-5 z-40 w-[min(360px,calc(100vw-40px))] border border-white/10 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl" style={{ background: "rgba(16,20,28,.9)" }}>
          <div className="px-5 pt-4 pb-3 border-b border-white/10">
            <p className="grotesk font-semibold text-[14.5px]">✦ Shop-assistenten</p>
            <p className="text-[11px] text-white/40">Svarar utifrån ert sortiment och din kvot.</p>
          </div>
          <div className="px-5 py-4 space-y-3 max-h-[240px] overflow-y-auto text-[12.5px]">
            {aiMsgs.length === 0 && <p className="text-white/30 italic">”Vad finns kvar av min kvot?” · ”Vilka storlekar finns hoodien i?”</p>}
            {aiMsgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <span className={"inline-block rounded-2xl px-3.5 py-2 whitespace-pre-line " + (m.role === "user" ? "text-[#0b0e13] font-medium" : "bg-white/[0.06] border border-white/10 text-white/80")}
                  style={m.role === "user" ? { background: brand } : {}}>{m.text}</span>
              </div>
            ))}
            {aiBusy && <p className="text-white/35">tänker…</p>}
          </div>
          <div className="px-4 pb-4 flex gap-2">
            <input value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendAI()}
              placeholder="Ställ en fråga…" className="flex-1 bg-white/[0.06] border border-white/15 rounded-full px-4 py-2.5 text-[12.5px] focus:outline-none focus:border-white/40" />
            <button onClick={() => sendAI()} className="rounded-full w-10 h-10 font-bold text-[#0b0e13] hover:opacity-90 transition-opacity" style={{ background: brand }}>→</button>
          </div>
        </div>
      )}

      {/* ===== Ordermodal ===== */}
      {mP && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMP(null)} />
          <div className="relative w-full max-w-[420px] p-6 border border-white/10 rounded-3xl backdrop-blur-xl" style={{ background: "rgba(16,20,28,.92)" }}>
            <div className="flex gap-4 items-center mb-5">
              <GarmentArt p={mP} className="w-20 h-20 flex-shrink-0" />
              <div>
                <p className="grotesk font-semibold text-[17px]">{mP.name}</p>
                <p className="text-[12px] text-white/45">{mP.category}</p>
                <p className="grotesk text-[15px] mt-0.5">{mP.price > 0 ? kr(mP.price) : "Ingår"}</p>
              </div>
            </div>
            {mP.sizes?.length > 0 && (<>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-bold mb-2">Storlek</p>
              <div className="flex gap-2 flex-wrap mb-5">
                {mP.sizes.map((s: string) => (
                  <button key={s} onClick={() => setMSize(s)}
                    className={"rounded-xl px-4 py-2 text-[12.5px] font-semibold border transition-colors " + (mSize === s ? "text-[#0b0e13]" : "border-white/15 text-white/65 hover:bg-white/[0.06]")}
                    style={mSize === s ? { background: brand, borderColor: brand } : {}}>{s}</button>
                ))}
              </div>
            </>)}
            <div className="flex items-center justify-between gap-3">
              <div className={GLASS + " flex items-center gap-2 rounded-full px-2 py-1.5"}>
                <button onClick={() => setMQty(Math.max(1, mQty - 1))} className="w-8 h-8 rounded-full hover:bg-white/10 transition-colors">−</button>
                <span className="w-5 text-center text-[14px] font-semibold">{mQty}</span>
                <button onClick={() => setMQty(Math.min(10, mQty + 1))} className="w-8 h-8 rounded-full hover:bg-white/10 transition-colors">+</button>
              </div>
              <button onClick={placeOrder} disabled={placing}
                className="flex-1 rounded-full py-3.5 text-[13.5px] font-bold text-[#0b0e13] hover:opacity-90 transition-opacity disabled:opacity-50" style={{ background: brand }}>
                {placing ? "Skickar…" : "Beställ"}
              </button>
            </div>
            <p className="text-[11px] text-white/35 mt-3 text-center">
              {model === "free" ? "Skickas direkt till behandling." : model === "attest" ? "Går till attest — du meddelas via mejl." : "Dras från din årskvot automatiskt."}
            </p>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] border border-white/10 rounded-full px-6 py-3 text-[13px] font-semibold shadow-2xl backdrop-blur-xl" style={{ background: "rgba(16,20,28,.92)" }}>{toastMsg}</div>
      )}
    </div>
  );
}
