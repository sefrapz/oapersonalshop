"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const kr = (n: number) => new Intl.NumberFormat("sv-SE").format(n) + " kr";
const GLASS = "bg-white/[0.055] border border-white/10 backdrop-blur-xl";

export default function Shop() {
  const { slug } = useParams<{ slug: string }>();
  const [cfg, setCfg] = useState<any>(null);
  const [err, setErr] = useState("");
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [cart, setCart] = useState<{ productId: string; size: string; qty: number }[]>([]);
  const [note, setNote] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [view, setView] = useState<"shop" | "cart" | "done" | "orders">("shop");
  const [done, setDone] = useState<any>(null);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetch(`/api/shop/config?slug=${slug}`).then((r) => r.json()).then((j) => {
      if (j.error) setErr(j.error); else setCfg(j);
    });
  }, [slug]);

  function flash(m: string) { setToast(m); setTimeout(() => setToast(""), 2600); }

  async function requestLink() {
    if (!email.includes("@")) return;
    await fetch("/api/auth/request-link", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, email }),
    });
    setLinkSent(true);
  }

  const products = cfg?.products || [];
  const brand = cfg?.tenant?.brand_color || "#7e22ce";
  const inCart = cart.reduce((s, c) => s + c.qty, 0);
  const totalOf = (c: typeof cart) => c.reduce((s, i) => {
    const p = products.find((x: any) => x.id === i.productId);
    return s + (p ? p.price * i.qty : 0);
  }, 0);

  function add(p: any, size: string) {
    if (p.sizes?.length && !size) { flash("Välj storlek först"); return; }
    setCart((c) => {
      const hit = c.find((i) => i.productId === p.id && i.size === size);
      if (hit) return c.map((i) => (i === hit ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { productId: p.id, size, qty: 1 }];
    });
    flash(p.name + " tillagd i varukorgen");
  }

  async function placeOrder() {
    setBusy(true);
    const r = await fetch("/api/shop/order", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart, note, costCenter }),
    });
    const j = await r.json();
    setBusy(false);
    if (j.error) { flash(j.error); return; }
    setDone(j); setCart([]); setNote(""); setView("done");
    fetch(`/api/shop/config?slug=${slug}`).then((r) => r.json()).then(setCfg);
  }

  async function loadOrders() {
    const j = await fetch("/api/shop/orders").then((r) => r.json());
    setMyOrders(j.orders || []); setView("orders");
  }

  // ===== Skal med aurora-bakgrund =====
  function Shell({ children }: { children: React.ReactNode }) {
    return (
      <div className="min-h-screen bg-[#0a0d12] text-white relative overflow-hidden" style={{ fontFamily: "'Inter',sans-serif" }}>
        <div className="pointer-events-none fixed w-[480px] h-[480px] rounded-full opacity-25 blur-[100px] -top-32 -left-24" style={{ background: brand }} />
        <div className="pointer-events-none fixed w-[420px] h-[420px] rounded-full opacity-20 blur-[100px] top-1/3 -right-32" style={{ background: "#2dd4bf" }} />
        <div className="pointer-events-none fixed w-[460px] h-[460px] rounded-full opacity-20 blur-[110px] -bottom-40 left-1/4" style={{ background: "#8b5cf6" }} />
        <div className="relative z-10 max-w-[1020px] mx-auto px-5 pb-16">{children}</div>
        {toast && (
          <div className="toast fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white text-[#0a0d12] rounded-full px-6 py-3 text-[13px] font-semibold shadow-2xl">
            {toast}
          </div>
        )}
        <p className="relative z-10 text-center text-[11px] text-white/25 pb-6">
          Drivs av <a href="https://oasystems.se" className="underline hover:text-white/50">OA Systems</a>
        </p>
      </div>
    );
  }

  function Header() {
    return (
      <header className="flex items-center justify-between gap-3 flex-wrap py-6">
        <div className="flex items-center gap-3.5">
          {cfg.tenant.logo_url
            ? <img src={cfg.tenant.logo_url} alt="" className="h-10 rounded-xl" />
            : <span className="w-11 h-11 rounded-2xl grotesk font-bold text-[18px] flex items-center justify-center text-[#0a0d12]" style={{ background: `linear-gradient(135deg, ${brand}, #2dd4bf)` }}>{cfg.tenant.name[0]}</span>}
          <div>
            <p className="grotesk font-semibold text-[17px] leading-tight">{cfg.tenant.name}</p>
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-white/40">Personalshop</p>
          </div>
        </div>
        {cfg.loggedIn && (
          <div className="flex gap-2.5 items-center flex-wrap">
            {cfg.quota && (
              <span className={`${GLASS} rounded-full px-4 py-2 text-[12px] text-white/70`}>
                Kvot kvar: <strong className="text-white">{cfg.quota.left} {cfg.quota.unit}</strong> <span className="text-white/40">av {cfg.quota.total}</span>
              </span>
            )}
            <button onClick={loadOrders} className={`${GLASS} rounded-full px-4 py-2 text-[12.5px] font-semibold hover:bg-white/10 transition-colors`}>Mina ordrar</button>
            <button onClick={() => setView("cart")} className="rounded-full px-5 py-2 text-[12.5px] font-semibold text-white transition-transform hover:scale-[1.03]" style={{ background: brand }}>
              Varukorg{inCart > 0 ? ` · ${inCart}` : ""}
            </button>
          </div>
        )}
      </header>
    );
  }

  if (err) return (
    <Shell><div className="pt-32 text-center pop">
      <h1 className="grotesk text-[26px] font-semibold">Butiken hittades inte</h1>
      <p className="text-white/45 text-[13.5px] mt-2">{err}</p>
    </div></Shell>
  );
  if (!cfg) return <Shell><p className="pt-32 text-center text-white/40 text-[14px]">Laddar…</p></Shell>;

  // ===== Inloggning =====
  if (!cfg.loggedIn) {
    return (
      <Shell>
        <Header />
        <div className={`pop ${GLASS} rounded-[28px] p-9 max-w-[440px] mx-auto mt-16 text-center`}>
          <span className="inline-flex w-14 h-14 rounded-2xl grotesk font-bold text-[22px] items-center justify-center text-[#0a0d12] mb-5" style={{ background: `linear-gradient(135deg, ${brand}, #2dd4bf)` }}>{cfg.tenant.name[0]}</span>
          <h1 className="grotesk text-[24px] font-semibold leading-snug">{cfg.tenant.welcome_text}</h1>
          {!linkSent ? (<>
            <p className="text-[13px] text-white/50 font-light mt-3 mb-6">Ange din jobbmejl så skickar vi en inloggningslänk — inga lösenord att hålla reda på.</p>
            <input
              className="w-full bg-white/[0.06] border border-white/15 rounded-2xl px-5 py-3.5 text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/40"
              placeholder="fornamn.efternamn@foretaget.se"
              value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && requestLink()}
            />
            <button onClick={requestLink} className="w-full mt-3 py-4 rounded-full font-semibold text-[14px] text-white transition-transform hover:scale-[1.01]" style={{ background: brand }}>
              Skicka inloggningslänk
            </button>
          </>) : (
            <p className="text-[13.5px] text-white/70 bg-white/[0.06] border border-white/10 rounded-2xl px-5 py-4 mt-5 leading-relaxed">
              ✉️ Om adressen finns registrerad har en länk skickats.<br />Kolla inkorgen — länken gäller i 15 minuter.
            </p>
          )}
        </div>
      </Shell>
    );
  }

  // ===== Bekräftelse =====
  if (view === "done" && done) {
    const attested = done.status === "pending_attest";
    return (
      <Shell>
        <Header />
        <div className={`pop ${GLASS} rounded-[28px] p-9 max-w-[460px] mx-auto mt-12 text-center`}>
          <span className="inline-flex w-14 h-14 rounded-full items-center justify-center text-[24px] mb-4" style={{ background: attested ? "#d97706" : "#16a34a" }}>{attested ? "⏳" : "✓"}</span>
          <h1 className="grotesk text-[23px] font-semibold">{attested ? "Skickad för attest" : "Tack för din beställning!"}</h1>
          <p className="text-[13.5px] text-white/55 font-light mt-2">
            Order <strong className="text-white">#{done.ticket}</strong>{attested ? " väntar på godkännande — du får mejl när den är hanterad." : " är mottagen och behandlas. Du meddelas när den är klar."}
          </p>
          <button onClick={() => setView("shop")} className="mt-6 px-7 py-3 rounded-full font-semibold text-[13.5px] text-white transition-transform hover:scale-[1.02]" style={{ background: brand }}>
            Tillbaka till butiken
          </button>
        </div>
      </Shell>
    );
  }

  // ===== Mina ordrar =====
  if (view === "orders") {
    const badge: any = { processing: ["Behandlas", "#38bdf8"], ready: ["Klar att hämta", "#4ade80"], pending_attest: ["Väntar attest", "#fbbf24"], rejected: ["Avslagen", "#f87171"], approved: ["Godkänd", "#4ade80"] };
    return (
      <Shell>
        <Header />
        <h1 className="grotesk text-[26px] font-semibold mt-4 mb-6 pop">Mina ordrar</h1>
        <div className="space-y-3 max-w-[640px]">
          {myOrders.length === 0 && <p className="text-white/40 text-[13.5px]">Inga ordrar än.</p>}
          {myOrders.map((o) => (
            <div key={o.id} className={`pop ${GLASS} rounded-2xl px-5 py-4 flex justify-between gap-4 flex-wrap`}>
              <div className="min-w-0">
                <span className="grotesk font-semibold text-[14.5px]">#{o.ticket}</span>
                <span className="text-[11.5px] text-white/35 ml-2.5">{new Date(o.created_at).toLocaleDateString("sv-SE")}</span>
                <p className="text-[12.5px] text-white/55 mt-1 truncate">{o.items.join(", ")}</p>
              </div>
              <div className="text-right">
                <p className="grotesk font-semibold text-[14.5px]">{kr(o.total)}</p>
                <p className="text-[11.5px] font-semibold mt-1" style={{ color: (badge[o.status] || ["", "#999"])[1] }}>{(badge[o.status] || [o.status])[0]}</p>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setView("shop")} className={`${GLASS} rounded-full px-5 py-2.5 text-[12.5px] font-semibold mt-6 hover:bg-white/10 transition-colors`}>← Tillbaka till butiken</button>
      </Shell>
    );
  }

  // ===== Varukorg =====
  if (view === "cart") {
    const total = totalOf(cart);
    const needsAttest = cfg.tenant.order_model === "attest" && (cfg.tenant.attest_threshold === 0 || total > cfg.tenant.attest_threshold);
    return (
      <Shell>
        <Header />
        <h1 className="grotesk text-[26px] font-semibold mt-4 mb-6 pop">Varukorg</h1>
        {cart.length === 0 ? (
          <div className="pop text-white/45 text-[14px]">
            Varukorgen är tom.
            <button onClick={() => setView("shop")} className={`${GLASS} rounded-full px-5 py-2.5 text-[12.5px] font-semibold text-white ml-3 hover:bg-white/10 transition-colors`}>Till butiken</button>
          </div>
        ) : (
          <div className="space-y-3 max-w-[600px]">
            {cart.map((i, idx) => {
              const p = products.find((x: any) => x.id === i.productId);
              return (
                <div key={idx} className={`pop ${GLASS} rounded-2xl px-5 py-3.5 flex items-center gap-4`}>
                  <span className="w-12 h-12 rounded-xl flex items-center justify-center grotesk font-bold text-[16px] text-[#0a0d12] flex-shrink-0"
                    style={p?.image_url ? { background: `url(${p.image_url}) center/cover` } : { background: `linear-gradient(135deg, ${p?.color || "#334155"}, ${brand})` }}>
                    {!p?.image_url && p?.name[0]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold truncate">{p?.name}{i.size ? <span className="text-white/45"> · {i.size}</span> : ""}</p>
                    <p className="text-[12px] text-white/40">{kr(p?.price || 0)}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button onClick={() => setCart((c) => c.map((x, xi) => xi === idx ? { ...x, qty: x.qty - 1 } : x).filter((x) => x.qty > 0))}
                      className="w-7 h-7 rounded-full border border-white/20 text-[14px] leading-none hover:bg-white/10 transition-colors">−</button>
                    <span className="text-[13.5px] w-5 text-center">{i.qty}</span>
                    <button onClick={() => setCart((c) => c.map((x, xi) => xi === idx ? { ...x, qty: x.qty + 1 } : x))}
                      className="w-7 h-7 rounded-full border border-white/20 text-[14px] leading-none hover:bg-white/10 transition-colors">+</button>
                  </div>
                </div>
              );
            })}
            <div className={`pop ${GLASS} rounded-[24px] p-6`}>
              <label className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-bold">Kostnadsställe / avdelning (frivilligt)</label>
              <input className="w-full bg-white/[0.06] border border-white/15 rounded-xl px-4 py-3 text-[13.5px] text-white placeholder-white/25 focus:outline-none focus:border-white/40 mt-1.5 mb-4"
                value={costCenter} onChange={(e) => setCostCenter(e.target.value)} placeholder="T.ex. Serviceteam" />
              <label className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-bold">Meddelande (frivilligt)</label>
              <input className="w-full bg-white/[0.06] border border-white/15 rounded-xl px-4 py-3 text-[13.5px] text-white placeholder-white/25 focus:outline-none focus:border-white/40 mt-1.5 mb-5"
                value={note} onChange={(e) => setNote(e.target.value)} placeholder="T.ex. ersätter trasig jacka" />
              <div className="flex justify-between grotesk text-[17px] font-semibold mb-3">
                <span>Totalt</span><span>{kr(total)}</span>
              </div>
              {needsAttest && <p className="text-[12px] text-amber-300/90 mb-3">⏳ Ordern skickas för attest till er inköpsansvarige innan den behandlas.</p>}
              {cfg.quota && <p className="text-[12px] text-white/45 mb-3">Kvot kvar efter köp: {cfg.quota.unit === "kr" ? Math.max(0, cfg.quota.left - total) + " kr" : Math.max(0, cfg.quota.left - inCart) + " plagg"}</p>}
              <button disabled={busy} onClick={placeOrder}
                className="w-full py-4 rounded-full font-semibold text-[14px] text-white transition-transform hover:scale-[1.01] disabled:opacity-50"
                style={{ background: brand }}>
                {busy ? "Skickar…" : "Skicka beställning"}
              </button>
            </div>
            <button onClick={() => setView("shop")} className={`${GLASS} rounded-full px-5 py-2.5 text-[12.5px] font-semibold hover:bg-white/10 transition-colors`}>← Fortsätt handla</button>
          </div>
        )}
      </Shell>
    );
  }

  // ===== Butik =====
  return (
    <Shell>
      <Header />
      <div className="pop mt-2 mb-8">
        <h1 className="grotesk text-[28px] md:text-[36px] font-semibold leading-tight">{cfg.tenant.welcome_text}</h1>
        <p className="text-white/45 text-[13.5px] font-light mt-1.5">Välj dina plagg — beställningen hanteras enligt ert företags regler, helt automatiskt.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((p: any, i: number) => <ProductCard key={p.id} p={p} brand={brand} onAdd={add} delay={i * 60} />)}
        {products.length === 0 && <p className="text-white/40 text-[13.5px] col-span-full">Inga produkter upplagda än.</p>}
      </div>
    </Shell>
  );
}

function ProductCard({ p, brand, onAdd, delay }: { p: any; brand: string; onAdd: (p: any, size: string) => void; delay: number }) {
  const [size, setSize] = useState("");
  return (
    <div className={`pop ${GLASS} rounded-[22px] overflow-hidden flex flex-col hover:border-white/25 transition-colors`} style={{ animationDelay: delay + "ms" }}>
      <div className="aspect-square flex items-center justify-center grotesk text-[44px] font-bold text-[#0a0d12]"
        style={p.image_url ? { background: `url(${p.image_url}) center/cover` } : { background: `linear-gradient(135deg, ${p.color}, ${brand})` }}>
        {!p.image_url && p.name[0]}
      </div>
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        <div>
          <p className="text-[9.5px] uppercase tracking-[0.18em] text-white/35 font-bold">{p.category}</p>
          <p className="text-[14px] font-semibold mt-0.5 leading-snug">{p.name}</p>
        </div>
        {p.sizes?.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {p.sizes.map((s: string) => (
              <button key={s} onClick={() => setSize(s)}
                className="rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition-colors"
                style={size === s ? { background: brand, borderColor: brand, color: "#fff" } : { borderColor: "rgba(255,255,255,.2)", color: "rgba(255,255,255,.65)" }}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="grotesk font-semibold text-[14.5px]">{p.price > 0 ? kr(p.price) : "Ingår"}</span>
          <button onClick={() => onAdd(p, size)}
            className="w-9 h-9 rounded-full text-white text-[18px] leading-none transition-transform hover:scale-110"
            style={{ background: brand }}>+</button>
        </div>
      </div>
    </div>
  );
}
