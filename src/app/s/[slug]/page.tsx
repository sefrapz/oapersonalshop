"use client";
import { useEffect, useMemo, useState } from "react";
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
  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [quick, setQuick] = useState<any>(null);
  const [sizeGuide, setSizeGuide] = useState(false);
  const [note, setNote] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [done, setDone] = useState<any>(null);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Alla");
  const [sort, setSort] = useState<"standard" | "prisLag" | "prisHog" | "namn">("standard");
  const [favs, setFavs] = useState<string[]>([]);
  const [sizePref, setSizePref] = useState<Record<string, string>>({});

  // ===== Lokala preferenser (favoriter + sparad storlek) =====
  useEffect(() => {
    try {
      setFavs(JSON.parse(localStorage.getItem("ps_favs_" + slug) || "[]"));
      setSizePref(JSON.parse(localStorage.getItem("ps_size_" + slug) || "{}"));
    } catch {}
  }, [slug]);
  function saveFavs(f: string[]) { setFavs(f); try { localStorage.setItem("ps_favs_" + slug, JSON.stringify(f)); } catch {} }
  function saveSize(pid: string, s: string) {
    const next = { ...sizePref, [pid]: s };
    setSizePref(next);
    try { localStorage.setItem("ps_size_" + slug, JSON.stringify(next)); } catch {}
  }

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
  const cartTotal = cart.reduce((s, i) => {
    const p = products.find((x: any) => x.id === i.productId);
    return s + (p ? p.price * i.qty : 0);
  }, 0);

  const cats = useMemo(() => ["Alla", ...Array.from(new Set(products.map((p: any) => p.category)))], [products]);
  const isNew = (p: any) => p.created_at && (Date.now() - new Date(p.created_at).getTime()) < 14 * 24 * 3600 * 1000;

  const filtered = useMemo(() => {
    let list = [...products];
    if (cat !== "Alla") list = list.filter((p) => p.category === cat);
    if (q.trim()) {
      const w = q.trim().toLowerCase();
      list = list.filter((p) => (p.name + " " + p.category).toLowerCase().includes(w));
    }
    if (sort === "prisLag") list.sort((a, b) => a.price - b.price);
    if (sort === "prisHog") list.sort((a, b) => b.price - a.price);
    if (sort === "namn") list.sort((a, b) => a.name.localeCompare(b.name, "sv"));
    // favoriter först i standardsortering
    if (sort === "standard") list.sort((a, b) => (favs.includes(b.id) ? 1 : 0) - (favs.includes(a.id) ? 1 : 0));
    return list;
  }, [products, cat, q, sort, favs]);

  const featured = useMemo(() => {
    if (!products.length) return null;
    return products.find((p: any) => favs.includes(p.id)) || products.find(isNew) || products[0];
  }, [products, favs]);

  function add(p: any, size: string, qty = 1) {
    if (p.sizes?.length && !size) { flash("Välj storlek först"); return; }
    if (size) saveSize(p.id, size);
    setCart((c) => {
      const hit = c.find((i) => i.productId === p.id && i.size === size);
      if (hit) return c.map((i) => (i === hit ? { ...i, qty: i.qty + qty } : i));
      return [...c, { productId: p.id, size, qty }];
    });
    flash(p.name + " tillagd ✓");
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
    setDone(j); setCart([]); setNote("");
    fetch(`/api/shop/config?slug=${slug}`).then((r) => r.json()).then(setCfg);
  }

  async function openOrders() {
    setOrdersOpen(true);
    const j = await fetch("/api/shop/orders").then((r) => r.json());
    setMyOrders(j.orders || []);
  }

  // "Beställ igen": matcha orderrader mot produktnamn
  function reorder(o: any) {
    let added = 0;
    for (const line of o.items as string[]) {
      const m = line.match(/^(.*?)(?:\s\((.*?)\))?\s×(\d+)$/);
      if (!m) continue;
      const p = products.find((x: any) => x.name === m[1]);
      if (!p) continue;
      add(p, m[2] || "", parseInt(m[3]) || 1);
      added++;
    }
    if (added) { setOrdersOpen(false); setCartOpen(true); }
    else flash("Produkterna finns inte längre i sortimentet");
  }

  // ===== Skal =====
  function Shell({ children }: { children: React.ReactNode }) {
    return (
      <div className="min-h-screen bg-[#0a0d12] text-white relative overflow-hidden" style={{ fontFamily: "'Inter',sans-serif" }}>
        <div className="pointer-events-none fixed w-[480px] h-[480px] rounded-full opacity-25 blur-[100px] -top-32 -left-24" style={{ background: brand }} />
        <div className="pointer-events-none fixed w-[420px] h-[420px] rounded-full opacity-20 blur-[100px] top-1/3 -right-32" style={{ background: "#2dd4bf" }} />
        <div className="pointer-events-none fixed w-[460px] h-[460px] rounded-full opacity-20 blur-[110px] -bottom-40 left-1/4" style={{ background: "#8b5cf6" }} />
        <div className="relative z-10 max-w-[1100px] mx-auto px-5 pb-16">{children}</div>
        {toast && <div className="toast fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-white text-[#0a0d12] rounded-full px-6 py-3 text-[13px] font-semibold shadow-2xl">{toast}</div>}
        <p className="relative z-10 text-center text-[11px] text-white/25 pb-6">Drivs av <a href="https://oasystems.se" className="underline hover:text-white/50">OA Systems</a></p>
      </div>
    );
  }

  function QuotaRing() {
    if (!cfg?.quota) return null;
    const pct = cfg.quota.total > 0 ? Math.max(0, Math.min(1, cfg.quota.left / cfg.quota.total)) : 0;
    const r = 15, c = 2 * Math.PI * r;
    return (
      <span className={`${GLASS} rounded-full pl-2 pr-4 py-1.5 flex items-center gap-2.5 text-[12px] text-white/70`}>
        <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
          <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="3.5" />
          <circle cx="18" cy="18" r={r} fill="none" stroke={brand} strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)" }} />
        </svg>
        <span>Kvot: <strong className="text-white">{cfg.quota.left} {cfg.quota.unit}</strong> kvar</span>
      </span>
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
            <QuotaRing />
            <button onClick={openOrders} className={`${GLASS} rounded-full px-4 py-2 text-[12.5px] font-semibold hover:bg-white/10 transition-colors`}>Mina ordrar</button>
            <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); location.reload(); }}
              className={`${GLASS} rounded-full px-4 py-2 text-[12.5px] font-semibold text-white/50 hover:bg-white/10 hover:text-white transition-colors`}>Logga ut</button>
            <button onClick={() => { setDone(null); setCartOpen(true); }} className="relative rounded-full px-5 py-2 text-[12.5px] font-semibold text-white transition-transform hover:scale-[1.03]" style={{ background: brand }}>
              Varukorg
              {inCart > 0 && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white text-[#0a0d12] text-[10.5px] font-bold flex items-center justify-center">{inCart}</span>}
            </button>
          </div>
        )}
      </header>
    );
  }

  if (err) return <Shell><div className="pt-32 text-center pop"><h1 className="grotesk text-[26px] font-semibold">Butiken hittades inte</h1><p className="text-white/45 text-[13.5px] mt-2">{err}</p></div></Shell>;

  if (!cfg) return (
    <Shell>
      <div className="pt-24 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <div key={i} className={`${GLASS} rounded-[22px] aspect-[3/4] animate-pulse`} />)}
      </div>
    </Shell>
  );

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
            <input className="w-full bg-white/[0.06] border border-white/15 rounded-2xl px-5 py-3.5 text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-white/40"
              placeholder="fornamn.efternamn@foretaget.se" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && requestLink()} />
            <button onClick={requestLink} className="w-full mt-3 py-4 rounded-full font-semibold text-[14px] text-white transition-transform hover:scale-[1.01]" style={{ background: brand }}>Skicka inloggningslänk</button>
          </>) : (
            <p className="text-[13.5px] text-white/70 bg-white/[0.06] border border-white/10 rounded-2xl px-5 py-4 mt-5 leading-relaxed">✉️ Om adressen finns registrerad har en länk skickats.<br />Kolla inkorgen — länken gäller i 15 minuter.</p>
          )}
        </div>
      </Shell>
    );
  }

  // ===== Butiken =====
  return (
    <Shell>
      <Header />

      {/* Hero + utvald produkt */}
      <div className="grid md:grid-cols-[1fr_320px] gap-5 mt-1 mb-7">
        <div className={`pop ${GLASS} rounded-[28px] p-8 flex flex-col justify-center`}>
          <p className="text-[10px] uppercase tracking-[0.22em] font-bold" style={{ color: brand }}>Välkommen{cfg.me?.name ? " " + cfg.me.name.split(" ")[0] : ""}</p>
          <h1 className="grotesk text-[26px] md:text-[34px] font-semibold leading-tight mt-2">{cfg.tenant.welcome_text}</h1>
          <p className="text-white/45 text-[13.5px] font-light mt-2 max-w-[420px]">
            {cfg.tenant.order_model === "quota" && "Din årskvot syns uppe till höger — den räknas ner automatiskt när du beställer."}
            {cfg.tenant.order_model === "attest" && "Beställningar attesteras av er inköpsansvarige — du får besked via mejl."}
            {cfg.tenant.order_model === "free" && "Beställ fritt — ordern går direkt till behandling och du meddelas när den är klar."}
          </p>
        </div>
        {featured && (
          <button onClick={() => setQuick(featured)} className={`pop ${GLASS} rounded-[28px] overflow-hidden text-left group relative`} style={{ animationDelay: "80ms" }}>
            <div className="absolute top-4 left-4 z-10 text-[9.5px] uppercase tracking-[0.18em] font-bold bg-white text-[#0a0d12] rounded-full px-3 py-1">{favs.includes(featured.id) ? "Din favorit" : isNew(featured) ? "Nyhet" : "Utvald"}</div>
            <div className="h-[150px] flex items-center justify-center grotesk text-[52px] font-bold text-[#0a0d12] transition-transform duration-500 group-hover:scale-[1.05]"
              style={featured.image_url ? { background: `url(${featured.image_url}) center/cover` } : { background: `linear-gradient(135deg, ${featured.color}, ${brand})` }}>
              {!featured.image_url && featured.name[0]}
            </div>
            <div className="p-5">
              <p className="text-[14.5px] font-semibold">{featured.name}</p>
              <p className="text-[12px] text-white/40 mt-0.5">{featured.category} · {featured.price > 0 ? kr(featured.price) : "Ingår"} · Snabbvy →</p>
            </div>
          </button>
        )}
      </div>

      {/* Sök / filter / sortering */}
      <div className={`pop ${GLASS} rounded-full px-3 py-2 flex items-center gap-2 flex-wrap mb-4`}>
        <div className="flex items-center gap-2 flex-1 min-w-[180px] px-2">
          <span className="text-white/35 text-[14px]">⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök i sortimentet…"
            className="bg-transparent flex-1 text-[13.5px] text-white placeholder-white/30 focus:outline-none py-1.5" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as any)}
          className="bg-white/[0.06] border border-white/15 rounded-full px-4 py-2 text-[12px] font-semibold text-white/80 focus:outline-none cursor-pointer [&>option]:text-black">
          <option value="standard">Sortering: Standard</option>
          <option value="prisLag">Pris: lägst först</option>
          <option value="prisHog">Pris: högst först</option>
          <option value="namn">Namn A–Ö</option>
        </select>
      </div>
      {cats.length > 2 && (
        <div className="pop flex gap-2 flex-wrap mb-6">
          {cats.map((c: any) => (
            <button key={c} onClick={() => setCat(c)}
              className="rounded-full px-4 py-1.5 text-[12px] font-semibold border transition-colors"
              style={cat === c ? { background: brand, borderColor: brand, color: "#fff" } : { borderColor: "rgba(255,255,255,.15)", color: "rgba(255,255,255,.6)" }}>
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Produktgrid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((p: any, i: number) => (
          <ProductCard key={p.id} p={p} brand={brand} onAdd={add} onQuick={() => setQuick(p)}
            fav={favs.includes(p.id)} onFav={() => saveFavs(favs.includes(p.id) ? favs.filter((f) => f !== p.id) : [...favs, p.id])}
            preSize={sizePref[p.id] || ""} isNew={isNew(p)} delay={i * 50} />
        ))}
        {filtered.length === 0 && (
          <div className={`${GLASS} rounded-[22px] col-span-full p-10 text-center text-white/45 text-[13.5px]`}>
            {products.length === 0 ? "Sortimentet läggs upp inom kort." : <>Inget matchade <strong className="text-white">”{q}”</strong>. <button className="underline" onClick={() => { setQ(""); setCat("Alla"); }}>Rensa sökningen</button></>}
          </div>
        )}
      </div>

      {products.length > 0 && (
        <button onClick={() => setSizeGuide(true)} className="mt-8 text-[12px] text-white/40 underline hover:text-white/70 transition-colors">📏 Storleksguide</button>
      )}

      {/* ===== Varukorgs-drawer ===== */}
      {cartOpen && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setCartOpen(false); setDone(null); }} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-[420px] bg-[#0e1219] border-l border-white/10 p-6 overflow-y-auto pop">
            {done ? (
              <div className="text-center pt-16">
                <span className="inline-flex w-16 h-16 rounded-full items-center justify-center text-[28px] mb-5" style={{ background: done.status === "pending_attest" ? "#d97706" : "#16a34a" }}>{done.status === "pending_attest" ? "⏳" : "✓"}</span>
                <h2 className="grotesk text-[22px] font-semibold">{done.status === "pending_attest" ? "Skickad för attest" : "Tack för din beställning!"}</h2>
                <p className="text-[13px] text-white/55 mt-2">Order <strong className="text-white">#{done.ticket}</strong>{done.status === "pending_attest" ? " väntar på godkännande — du får mejl när den hanterats." : " behandlas nu. Du meddelas när den är klar att hämta."}</p>
                <button onClick={() => { setCartOpen(false); setDone(null); }} className="mt-7 px-7 py-3 rounded-full font-semibold text-[13.5px] text-white" style={{ background: brand }}>Fortsätt handla</button>
              </div>
            ) : (<>
              <div className="flex items-center justify-between mb-6">
                <h2 className="grotesk text-[20px] font-semibold">Varukorg {inCart > 0 && <span className="text-white/40 text-[14px]">· {inCart} st</span>}</h2>
                <button onClick={() => setCartOpen(false)} className="w-9 h-9 rounded-full border border-white/15 hover:bg-white/10 transition-colors">✕</button>
              </div>
              {cart.length === 0 ? (
                <p className="text-white/40 text-[13.5px] pt-8 text-center">Varukorgen är tom.<br /><span className="text-white/25 text-[12px]">Tips: klicka på en produkt för snabbvy.</span></p>
              ) : (<>
                <div className="space-y-3">
                  {cart.map((i, idx) => {
                    const p = products.find((x: any) => x.id === i.productId);
                    return (
                      <div key={idx} className={`${GLASS} rounded-2xl px-4 py-3.5 flex items-center gap-3.5`}>
                        <span className="w-11 h-11 rounded-xl flex items-center justify-center grotesk font-bold text-[15px] text-[#0a0d12] flex-shrink-0"
                          style={p?.image_url ? { background: `url(${p.image_url}) center/cover` } : { background: `linear-gradient(135deg, ${p?.color || "#334155"}, ${brand})` }}>
                          {!p?.image_url && p?.name[0]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold truncate">{p?.name}{i.size ? <span className="text-white/45"> · {i.size}</span> : ""}</p>
                          <p className="text-[11.5px] text-white/40">{kr((p?.price || 0) * i.qty)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setCart((c) => c.map((x, xi) => xi === idx ? { ...x, qty: x.qty - 1 } : x).filter((x) => x.qty > 0))} className="w-7 h-7 rounded-full border border-white/20 text-[13px] leading-none hover:bg-white/10">−</button>
                          <span className="text-[13px] w-4 text-center">{i.qty}</span>
                          <button onClick={() => setCart((c) => c.map((x, xi) => xi === idx ? { ...x, qty: x.qty + 1 } : x))} className="w-7 h-7 rounded-full border border-white/20 text-[13px] leading-none hover:bg-white/10">+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 space-y-3">
                  <input className="w-full bg-white/[0.06] border border-white/15 rounded-xl px-4 py-3 text-[13px] text-white placeholder-white/25 focus:outline-none focus:border-white/40"
                    value={costCenter} onChange={(e) => setCostCenter(e.target.value)} placeholder="Kostnadsställe / avdelning (frivilligt)" />
                  <input className="w-full bg-white/[0.06] border border-white/15 rounded-xl px-4 py-3 text-[13px] text-white placeholder-white/25 focus:outline-none focus:border-white/40"
                    value={note} onChange={(e) => setNote(e.target.value)} placeholder="Meddelande (frivilligt)" />
                </div>
                <div className="flex justify-between grotesk text-[17px] font-semibold mt-5 mb-2"><span>Totalt</span><span>{kr(cartTotal)}</span></div>
                {cfg.tenant.order_model === "attest" && (cfg.tenant.attest_threshold === 0 || cartTotal > cfg.tenant.attest_threshold) &&
                  <p className="text-[12px] text-amber-300/90 mb-2">⏳ Ordern attesteras av er inköpsansvarige innan behandling.</p>}
                {cfg.quota && <p className="text-[12px] text-white/45 mb-2">Kvot kvar efter köp: {cfg.quota.unit === "kr" ? Math.max(0, cfg.quota.left - cartTotal) + " kr" : Math.max(0, cfg.quota.left - inCart) + " plagg"}</p>}
                <button disabled={busy} onClick={placeOrder} className="w-full py-4 rounded-full font-semibold text-[14px] text-white transition-transform hover:scale-[1.01] disabled:opacity-50" style={{ background: brand }}>
                  {busy ? "Skickar…" : "Skicka beställning"}
                </button>
              </>)}
            </>)}
          </aside>
        </div>
      )}

      {/* ===== Mina ordrar-drawer ===== */}
      {ordersOpen && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOrdersOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-[420px] bg-[#0e1219] border-l border-white/10 p-6 overflow-y-auto pop">
            <div className="flex items-center justify-between mb-6">
              <h2 className="grotesk text-[20px] font-semibold">Mina ordrar</h2>
              <button onClick={() => setOrdersOpen(false)} className="w-9 h-9 rounded-full border border-white/15 hover:bg-white/10 transition-colors">✕</button>
            </div>
            {myOrders.length === 0 && <p className="text-white/40 text-[13.5px] text-center pt-8">Inga ordrar än.</p>}
            <div className="space-y-3">
              {myOrders.map((o) => <OrderCard key={o.id} o={o} brand={brand} onReorder={() => reorder(o)} />)}
            </div>
          </aside>
        </div>
      )}

      {/* ===== Snabbvy ===== */}
      {quick && <QuickView p={quick} brand={brand} preSize={sizePref[quick.id] || ""} fav={favs.includes(quick.id)}
        onFav={() => saveFavs(favs.includes(quick.id) ? favs.filter((f) => f !== quick.id) : [...favs, quick.id])}
        onAdd={(size: string, qty: number) => { add(quick, size, qty); setQuick(null); }} onClose={() => setQuick(null)} isNew={isNew(quick)} />}

      {/* ===== Storleksguide ===== */}
      {sizeGuide && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSizeGuide(false)} />
          <div className={`relative ${GLASS} bg-[#0e1219] rounded-[24px] p-7 max-w-[420px] w-full pop`}>
            <h3 className="grotesk text-[18px] font-semibold mb-4">📏 Storleksguide (cm, bröstvidd)</h3>
            <div className="grid grid-cols-6 gap-2 text-center text-[12px]">
              {["XS", "S", "M", "L", "XL", "XXL"].map((s) => <div key={s} className="font-bold text-white/80">{s}</div>)}
              {["86–91", "92–97", "98–104", "105–112", "113–121", "122–130"].map((v, i) => <div key={i} className="text-white/50">{v}</div>)}
            </div>
            <p className="text-[11.5px] text-white/40 mt-4">Osäker? Ta storleken du brukar ha i vardagsplagg — profilkläder är normala i storlekarna.</p>
            <button onClick={() => setSizeGuide(false)} className="mt-5 w-full py-3 rounded-full font-semibold text-[13px] text-white" style={{ background: brand }}>Stäng</button>
          </div>
        </div>
      )}
    </Shell>
  );
}

// ===== Produktkort =====
function ProductCard({ p, brand, onAdd, onQuick, fav, onFav, preSize, isNew, delay }: any) {
  const [size, setSize] = useState(preSize && p.sizes?.includes(preSize) ? preSize : "");
  return (
    <div className={`pop ${GLASS} rounded-[22px] overflow-hidden flex flex-col hover:border-white/25 hover:-translate-y-1 transition-all duration-300`} style={{ animationDelay: delay + "ms" }}>
      <button onClick={onQuick} className="relative aspect-square flex items-center justify-center grotesk text-[44px] font-bold text-[#0a0d12] group overflow-hidden"
        style={p.image_url ? { background: `url(${p.image_url}) center/cover` } : { background: `linear-gradient(135deg, ${p.color}, ${brand})` }}>
        {!p.image_url && p.name[0]}
        {isNew && <span className="absolute top-3 left-3 text-[9px] uppercase tracking-[0.18em] font-bold bg-white text-[#0a0d12] rounded-full px-2.5 py-0.5">Nyhet</span>}
        <span className="absolute inset-x-0 bottom-0 py-2 text-[11px] font-semibold text-white bg-black/50 backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity">Snabbvy</span>
      </button>
      <button onClick={onFav} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/35 backdrop-blur flex items-center justify-center text-[14px] hover:scale-110 transition-transform" aria-label="Favorit">
        {fav ? "❤️" : "🤍"}
      </button>
      <div className="p-4 flex flex-col gap-2.5 flex-1 relative">
        <div>
          <p className="text-[9.5px] uppercase tracking-[0.18em] text-white/35 font-bold">{p.category}</p>
          <p className="text-[14px] font-semibold mt-0.5 leading-snug">{p.name}</p>
        </div>
        {p.sizes?.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {p.sizes.map((s: string) => (
              <button key={s} onClick={() => setSize(s)} className="rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition-colors"
                style={size === s ? { background: brand, borderColor: brand, color: "#fff" } : { borderColor: "rgba(255,255,255,.2)", color: "rgba(255,255,255,.65)" }}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="grotesk font-semibold text-[14.5px]">{p.price > 0 ? kr(p.price) : "Ingår"}</span>
          <button onClick={() => onAdd(p, size)} className="w-9 h-9 rounded-full text-white text-[18px] leading-none transition-transform hover:scale-110" style={{ background: brand }}>+</button>
        </div>
      </div>
    </div>
  );
}

// ===== Snabbvy-modal =====
function QuickView({ p, brand, onAdd, onClose, preSize, fav, onFav, isNew }: any) {
  const [size, setSize] = useState(preSize && p.sizes?.includes(preSize) ? preSize : "");
  const [qty, setQty] = useState(1);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0e1219] border border-white/10 rounded-[26px] overflow-hidden max-w-[680px] w-full grid sm:grid-cols-2 pop">
        <div className="relative aspect-square sm:aspect-auto flex items-center justify-center grotesk text-[72px] font-bold text-[#0a0d12] min-h-[240px]"
          style={p.image_url ? { background: `url(${p.image_url}) center/cover` } : { background: `linear-gradient(135deg, ${p.color}, ${brand})` }}>
          {!p.image_url && p.name[0]}
          {isNew && <span className="absolute top-4 left-4 text-[9.5px] uppercase tracking-[0.18em] font-bold bg-white text-[#0a0d12] rounded-full px-3 py-1">Nyhet</span>}
        </div>
        <div className="p-7 flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/35 font-bold">{p.category}</p>
              <h3 className="grotesk text-[22px] font-semibold mt-1 leading-snug">{p.name}</h3>
            </div>
            <button onClick={onFav} className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center text-[15px] hover:bg-white/10 transition-colors flex-shrink-0">{fav ? "❤️" : "🤍"}</button>
          </div>
          <p className="grotesk text-[19px] font-semibold mt-3" style={{ color: brand }}>{p.price > 0 ? kr(p.price) : "Ingår i din kvot"}</p>
          {p.sizes?.length > 0 && (<>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-bold mt-5 mb-2">Storlek {preSize && <span className="normal-case tracking-normal text-white/30 font-normal">· din sparade: {preSize}</span>}</p>
            <div className="flex gap-2 flex-wrap">
              {p.sizes.map((s: string) => (
                <button key={s} onClick={() => setSize(s)} className="rounded-xl px-3.5 py-2 text-[12.5px] font-semibold border transition-colors"
                  style={size === s ? { background: brand, borderColor: brand, color: "#fff" } : { borderColor: "rgba(255,255,255,.2)", color: "rgba(255,255,255,.65)" }}>
                  {s}
                </button>
              ))}
            </div>
          </>)}
          <div className="flex items-center gap-3 mt-5">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 rounded-full border border-white/20 hover:bg-white/10 transition-colors">−</button>
            <span className="grotesk text-[16px] font-semibold w-6 text-center">{qty}</span>
            <button onClick={() => setQty(Math.min(20, qty + 1))} className="w-9 h-9 rounded-full border border-white/20 hover:bg-white/10 transition-colors">+</button>
          </div>
          <button onClick={() => onAdd(size, qty)} className="mt-auto pt-6">
            <span className="block w-full py-4 rounded-full font-semibold text-[14px] text-white text-center transition-transform hover:scale-[1.01]" style={{ background: brand }}>
              Lägg i varukorgen {p.price > 0 ? "· " + kr(p.price * qty) : ""}
            </span>
          </button>
        </div>
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur border border-white/15 hover:bg-white/10 transition-colors">✕</button>
      </div>
    </div>
  );
}

// ===== Orderkort med statustidslinje =====
function OrderCard({ o, brand, onReorder }: any) {
  const FLOW: Record<string, number> = { pending_attest: 0, approved: 1, processing: 1, ready: 2, rejected: -1 };
  const step = FLOW[o.status] ?? 1;
  const labels = o.status === "rejected" ? ["Mottagen", "Avslagen", ""] : ["Mottagen", o.status === "pending_attest" ? "Väntar attest" : "Behandlas", "Klar att hämta"];
  return (
    <div className={`${GLASS} rounded-2xl p-5`}>
      <div className="flex justify-between items-baseline gap-3">
        <span className="grotesk font-semibold text-[14.5px]">#{o.ticket}</span>
        <span className="text-[11px] text-white/35">{new Date(o.created_at).toLocaleDateString("sv-SE")}</span>
      </div>
      <p className="text-[12px] text-white/55 mt-1.5">{o.items.join(", ")}</p>
      <div className="flex items-center mt-4 mb-1">
        {labels.filter(Boolean).map((l, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <span className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center"
                style={o.status === "rejected" && i === 1 ? { background: "#b91c1c", color: "#fff" }
                  : i <= step ? { background: brand, color: "#fff" } : { background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.35)" }}>
                {o.status === "rejected" && i === 1 ? "✕" : i <= step ? "✓" : i + 1}
              </span>
              <span className="text-[9px] text-white/40 mt-1 whitespace-nowrap">{l}</span>
            </div>
            {i < labels.filter(Boolean).length - 1 && <span className="flex-1 h-px mx-1.5 -mt-3.5" style={{ background: i < step ? brand : "rgba(255,255,255,.12)" }} />}
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center mt-3">
        <span className="grotesk font-semibold text-[13.5px]">{kr(o.total)}</span>
        <button onClick={onReorder} className="text-[11.5px] font-semibold underline text-white/60 hover:text-white transition-colors">Beställ igen ↻</button>
      </div>
    </div>
  );
}
