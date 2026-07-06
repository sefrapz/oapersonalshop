"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const kr = (n: number) => new Intl.NumberFormat("sv-SE").format(n) + " kr";

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
    flash(p.name + " tillagd");
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
    // uppdatera kvot
    fetch(`/api/shop/config?slug=${slug}`).then((r) => r.json()).then(setCfg);
  }

  async function loadOrders() {
    const j = await fetch("/api/shop/orders").then((r) => r.json());
    setMyOrders(j.orders || []); setView("orders");
  }

  const S: any = {
    page: { maxWidth: 960, margin: "0 auto", padding: "0 18px 60px" },
    card: { background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 24, padding: 24 },
    btn: { background: brand, color: "#fff", border: 0, borderRadius: 999, padding: "12px 24px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
    ghost: { background: "#fff", border: "1px solid rgba(0,0,0,.15)", borderRadius: 999, padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
    inp: { width: "100%", border: "1px solid rgba(0,0,0,.15)", borderRadius: 12, padding: "12px 14px", fontSize: 14, boxSizing: "border-box" as const },
    label: { fontSize: 10, textTransform: "uppercase" as const, letterSpacing: 1.5, color: "rgba(0,0,0,.4)", fontWeight: 700 },
  };

  if (err) return <div style={{ ...S.page, paddingTop: 80, textAlign: "center" }}><h1>Butiken hittades inte</h1><p style={{ color: "#666" }}>{err}</p></div>;
  if (!cfg) return <div style={{ ...S.page, paddingTop: 80, textAlign: "center", color: "#888" }}>Laddar…</div>;

  const Header = (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 0", flexWrap: "wrap", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {cfg.tenant.logo_url
          ? <img src={cfg.tenant.logo_url} alt="" style={{ height: 38, borderRadius: 10 }} />
          : <span style={{ width: 40, height: 40, borderRadius: 12, background: brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 17 }}>{cfg.tenant.name[0]}</span>}
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 16 }}>{cfg.tenant.name}</p>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(0,0,0,.45)" }}>Personalshop</p>
        </div>
      </div>
      {cfg.loggedIn && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {cfg.quota && (
            <span style={{ fontSize: 12, background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 999, padding: "8px 14px" }}>
              Kvot kvar: <strong>{cfg.quota.left} {cfg.quota.unit}</strong> av {cfg.quota.total}
            </span>
          )}
          <button style={S.ghost} onClick={loadOrders}>Mina ordrar</button>
          <button style={{ ...S.btn, position: "relative" }} onClick={() => setView("cart")}>
            Varukorg{inCart > 0 ? ` (${inCart})` : ""}
          </button>
        </div>
      )}
    </header>
  );

  // ===== Inloggning =====
  if (!cfg.loggedIn) {
    return (
      <div style={S.page}>
        {Header}
        <div style={{ ...S.card, maxWidth: 440, margin: "60px auto 0", textAlign: "center" }}>
          <span style={{ width: 52, height: 52, borderRadius: 16, background: brand, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 20, marginBottom: 16 }}>{cfg.tenant.name[0]}</span>
          <h1 style={{ fontSize: 22, margin: "0 0 8px", letterSpacing: "-0.01em" }}>{cfg.tenant.welcome_text}</h1>
          {!linkSent ? (<>
            <p style={{ fontSize: 13.5, color: "rgba(0,0,0,.55)", margin: "0 0 20px" }}>Ange din jobbmejl så skickar vi en inloggningslänk — inga lösenord.</p>
            <input style={S.inp} placeholder="fornamn.efternamn@foretaget.se" value={email}
              onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && requestLink()} />
            <button style={{ ...S.btn, width: "100%", marginTop: 12 }} onClick={requestLink}>Skicka inloggningslänk</button>
          </>) : (
            <p style={{ fontSize: 14, color: "rgba(0,0,0,.6)", background: "#f5f0fb", borderRadius: 14, padding: "16px 18px" }}>
              ✉️ Om adressen finns registrerad har en länk skickats.<br />Kolla inkorgen — länken gäller i 15 minuter.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ===== Bekräftelse =====
  if (view === "done" && done) {
    const attested = done.status === "pending_attest";
    return (
      <div style={S.page}>
        {Header}
        <div style={{ ...S.card, maxWidth: 460, margin: "50px auto 0", textAlign: "center" }}>
          <span style={{ width: 56, height: 56, borderRadius: "50%", background: attested ? "#d97706" : "#15803d", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 16 }}>{attested ? "⏳" : "✓"}</span>
          <h1 style={{ fontSize: 21, margin: "0 0 8px" }}>{attested ? "Order skickad för attest" : "Tack för din beställning!"}</h1>
          <p style={{ fontSize: 13.5, color: "rgba(0,0,0,.55)" }}>
            Order <strong>#{done.ticket}</strong>{attested ? " väntar på godkännande — du får mejl när den är hanterad." : " är mottagen och behandlas. Du meddelas när den är klar."}
          </p>
          <button style={{ ...S.btn, marginTop: 16 }} onClick={() => setView("shop")}>Tillbaka till butiken</button>
        </div>
      </div>
    );
  }

  // ===== Mina ordrar =====
  if (view === "orders") {
    const badge: any = { processing: ["Behandlas", "#2563eb"], ready: ["Klar att hämta", "#15803d"], pending_attest: ["Väntar attest", "#d97706"], rejected: ["Avslagen", "#b91c1c"], approved: ["Godkänd", "#15803d"] };
    return (
      <div style={S.page}>
        {Header}
        <h1 style={{ fontSize: 24, letterSpacing: "-0.01em" }}>Mina ordrar</h1>
        <div style={{ display: "grid", gap: 12 }}>
          {myOrders.length === 0 && <p style={{ color: "#777", fontSize: 14 }}>Inga ordrar än.</p>}
          {myOrders.map((o) => (
            <div key={o.id} style={{ ...S.card, padding: "16px 20px", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <strong style={{ fontSize: 14 }}>#{o.ticket}</strong>
                <span style={{ fontSize: 12, color: "#888", marginLeft: 10 }}>{new Date(o.created_at).toLocaleDateString("sv-SE")}</span>
                <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "rgba(0,0,0,.55)" }}>{o.items.join(", ")}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong style={{ fontSize: 14 }}>{kr(o.total)}</strong>
                <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 600, color: (badge[o.status] || ["", "#666"])[1] }}>{(badge[o.status] || [o.status])[0]}</p>
              </div>
            </div>
          ))}
        </div>
        <button style={{ ...S.ghost, marginTop: 18 }} onClick={() => setView("shop")}>← Tillbaka till butiken</button>
      </div>
    );
  }

  // ===== Varukorg =====
  if (view === "cart") {
    const total = totalOf(cart);
    const needsAttest = cfg.tenant.order_model === "attest" && (cfg.tenant.attest_threshold === 0 || total > cfg.tenant.attest_threshold);
    return (
      <div style={S.page}>
        {Header}
        <h1 style={{ fontSize: 24, letterSpacing: "-0.01em" }}>Varukorg</h1>
        {cart.length === 0 ? <p style={{ color: "#777" }}>Tom. <button style={{ ...S.ghost, marginLeft: 8 }} onClick={() => setView("shop")}>Till butiken</button></p> : (
          <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
            {cart.map((i, idx) => {
              const p = products.find((x: any) => x.id === i.productId);
              return (
                <div key={idx} style={{ ...S.card, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, background: p?.image_url ? `url(${p.image_url}) center/cover` : (p?.color || "#334155"), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>{!p?.image_url && p?.name[0]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 13.5 }}>{p?.name}{i.size ? " · " + i.size : ""}</p>
                    <p style={{ margin: 0, fontSize: 12, color: "#888" }}>{kr(p?.price || 0)}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button style={{ ...S.ghost, padding: "4px 11px" }} onClick={() => setCart((c) => c.map((x, xi) => xi === idx ? { ...x, qty: x.qty - 1 } : x).filter((x) => x.qty > 0))}>−</button>
                    <span style={{ fontSize: 13, width: 18, textAlign: "center" }}>{i.qty}</span>
                    <button style={{ ...S.ghost, padding: "4px 10px" }} onClick={() => setCart((c) => c.map((x, xi) => xi === idx ? { ...x, qty: x.qty + 1 } : x))}>+</button>
                  </div>
                </div>
              );
            })}
            <div style={S.card}>
              <p style={S.label}>Kostnadsställe / avdelning (frivilligt)</p>
              <input style={{ ...S.inp, margin: "6px 0 14px" }} value={costCenter} onChange={(e) => setCostCenter(e.target.value)} placeholder="T.ex. Serviceteam" />
              <p style={S.label}>Meddelande (frivilligt)</p>
              <input style={{ ...S.inp, margin: "6px 0 16px" }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="T.ex. ersätter trasig jacka" />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                <span>Totalt</span><span>{kr(total)}</span>
              </div>
              {needsAttest && <p style={{ fontSize: 12, color: "#d97706", margin: "0 0 10px" }}>⏳ Ordern skickas för attest till er inköpsansvarige innan den behandlas.</p>}
              {cfg.quota && <p style={{ fontSize: 12, color: "rgba(0,0,0,.5)", margin: "0 0 10px" }}>Kvot kvar efter köp: {cfg.quota.unit === "kr" ? Math.max(0, cfg.quota.left - total) + " kr" : Math.max(0, cfg.quota.left - inCart) + " plagg"}</p>}
              <button style={{ ...S.btn, width: "100%", opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={placeOrder}>{busy ? "Skickar…" : "Skicka beställning"}</button>
            </div>
            <button style={S.ghost} onClick={() => setView("shop")}>← Fortsätt handla</button>
          </div>
        )}
        {toast && <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#111", color: "#fff", borderRadius: 999, padding: "10px 22px", fontSize: 13 }}>{toast}</div>}
      </div>
    );
  }

  // ===== Butik =====
  return (
    <div style={S.page}>
      {Header}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 }}>
        {products.map((p: any) => <ProductCard key={p.id} p={p} brand={brand} onAdd={add} />)}
        {products.length === 0 && <p style={{ color: "#777" }}>Inga produkter upplagda än.</p>}
      </div>
      {toast && <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#111", color: "#fff", borderRadius: 999, padding: "10px 22px", fontSize: 13, zIndex: 50 }}>{toast}</div>}
      <p style={{ textAlign: "center", fontSize: 11, color: "rgba(0,0,0,.35)", marginTop: 40 }}>Drivs av <a href="https://oasystems.se" style={{ color: "inherit" }}>OA Systems</a></p>
    </div>
  );
}

function ProductCard({ p, brand, onAdd }: { p: any; brand: string; onAdd: (p: any, size: string) => void }) {
  const [size, setSize] = useState("");
  return (
    <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ aspectRatio: "1", background: p.image_url ? `url(${p.image_url}) center/cover` : p.color, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.9)", fontSize: 42, fontWeight: 700 }}>
        {!p.image_url && p.name[0]}
      </div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div>
          <p style={{ margin: 0, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 1.5, color: "rgba(0,0,0,.4)", fontWeight: 700 }}>{p.category}</p>
          <p style={{ margin: "3px 0 0", fontWeight: 600, fontSize: 14 }}>{p.name}</p>
        </div>
        {p.sizes?.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {p.sizes.map((s: string) => (
              <button key={s} onClick={() => setSize(s)}
                style={{ border: "1px solid " + (size === s ? brand : "rgba(0,0,0,.15)"), background: size === s ? brand : "#fff", color: size === s ? "#fff" : "#333", borderRadius: 8, padding: "3px 9px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>{s}</button>
            ))}
          </div>
        )}
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <strong style={{ fontSize: 14 }}>{p.price > 0 ? kr(p.price) : "Ingår"}</strong>
          <button onClick={() => onAdd(p, size)}
            style={{ background: brand, color: "#fff", border: 0, borderRadius: 999, width: 32, height: 32, fontSize: 17, cursor: "pointer", lineHeight: 1 }}>+</button>
        </div>
      </div>
    </div>
  );
}
