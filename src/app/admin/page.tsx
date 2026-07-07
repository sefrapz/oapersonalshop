"use client";
import { useEffect, useState } from "react";

const kr = (n: number) => new Intl.NumberFormat("sv-SE").format(n) + " kr";

export default function Admin() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [tab, setTab] = useState<"dashboard" | "install" | "utseende" | "produkter" | "personal" | "ordrar">("dashboard");
  const [stats, setStats] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [products, setProducts] = useState<any[]>([]);
  const [pForm, setPForm] = useState<any>({});
  const [staff, setStaff] = useState<any[]>([]);
  const [staffList, setStaffList] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [status, setStatus] = useState("");

  const h = { "Content-Type": "application/json", "x-admin-secret": secret };

  async function loadTenants(s = secret) {
    const r = await fetch("/api/admin/tenants", { headers: { "x-admin-secret": s } });
    if (r.status === 401) { setStatus("Fel ADMIN_SECRET"); return; }
    const j = await r.json();
    setTenants(j.tenants || []); setAuthed(true); setStatus("");
  }
  function pick(t: any) {
    setSel(t); setTab("dashboard");
    setForm({ ...t, footer_lines: (t.footer_lines || []).join("\n") });
    loadProducts(t.id); loadStaff(t.id); loadOrders(t.id); loadStats(t.id);
  }
  async function loadStats(id: string) { const j = await fetch(`/api/admin/stats?tenantId=${id}`, { headers: h }).then((r) => r.json()); setStats(j.error ? null : j); }
  async function quickUpdate(patch: any) {
    const j = await fetch("/api/admin/tenant-update", { method: "POST", headers: h, body: JSON.stringify({ id: sel.id, ...patch }) }).then((r) => r.json());
    if (j.error) { setStatus("Fel: " + j.error); return; }
    setSel(j.tenant); setForm({ ...j.tenant, footer_lines: (j.tenant.footer_lines || []).join("\n") });
    setStatus("Publicerat ✓ — syns direkt i butiken"); loadTenants();
  }
  async function setRole(id: string, role: string) {
    await fetch("/api/admin/staff", { method: "PATCH", headers: h, body: JSON.stringify({ id, role }) });
    loadStaff(sel.id); setStatus(role === "manager" ? "Chefsroll satt ✓ — attestkorgen syns i butiken" : "Roll ändrad ✓");
  }
  async function loadProducts(id: string) { const j = await fetch(`/api/admin/products?tenantId=${id}`, { headers: h }).then((r) => r.json()); setProducts(j.products || []); }
  async function loadStaff(id: string) { const j = await fetch(`/api/admin/staff?tenantId=${id}`, { headers: h }).then((r) => r.json()); setStaff(j.staff || []); }
  async function loadOrders(id: string) { const j = await fetch(`/api/admin/orders?tenantId=${id}`, { headers: h }).then((r) => r.json()); setOrders(j.orders || []); }

  async function saveTenant(createNew = false) {
    const body = createNew ? { ...form } : { ...form, id: sel?.id };
    if (createNew) delete body.id;
    const j = await fetch("/api/admin/tenants", { method: "POST", headers: h, body: JSON.stringify(body) }).then((r) => r.json());
    if (j.error) { setStatus("Fel: " + j.error); return; }
    setStatus("Sparat ✓"); loadTenants(); if (j.tenant) pick(j.tenant);
  }
  async function saveProduct() {
    const j = await fetch("/api/admin/products", { method: "POST", headers: h, body: JSON.stringify({ ...pForm, tenantId: sel.id }) }).then((r) => r.json());
    if (j.error) { setStatus("Fel: " + j.error); return; }
    setPForm({}); loadProducts(sel.id); setStatus("Produkt sparad ✓");
  }
  async function delProduct(id: string) { await fetch("/api/admin/products", { method: "DELETE", headers: h, body: JSON.stringify({ id }) }); loadProducts(sel.id); }
  async function addStaff() {
    const j = await fetch("/api/admin/staff", { method: "POST", headers: h, body: JSON.stringify({ tenantId: sel.id, list: staffList }) }).then((r) => r.json());
    setStatus(j.error ? "Fel: " + j.error : `${j.added} personer tillagda ✓`); setStaffList(""); loadStaff(sel.id);
  }
  async function delStaff(id: string) { await fetch("/api/admin/staff", { method: "DELETE", headers: h, body: JSON.stringify({ id }) }); loadStaff(sel.id); }
  async function setOrderStatus(id: string, st: string) { await fetch("/api/admin/orders", { method: "PATCH", headers: h, body: JSON.stringify({ id, status: st }) }); loadOrders(sel.id); }

  const S: any = {
    wrap: { maxWidth: 1080, margin: "0 auto", padding: "30px 18px 80px" },
    card: { background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 20, padding: 22, marginBottom: 16 },
    inp: { width: "100%", border: "1px solid rgba(0,0,0,.15)", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, boxSizing: "border-box" as const, marginBottom: 10 },
    btn: { background: "#7e22ce", color: "#fff", border: 0, borderRadius: 999, padding: "10px 22px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
    ghost: { background: "#fff", border: "1px solid rgba(0,0,0,.15)", borderRadius: 999, padding: "8px 16px", fontWeight: 600, fontSize: 12, cursor: "pointer" },
    label: { fontSize: 10, textTransform: "uppercase" as const, letterSpacing: 1.4, color: "rgba(0,0,0,.45)", fontWeight: 700, display: "block", marginBottom: 4 },
    tab: (a: boolean) => ({ ...({ background: a ? "#7e22ce" : "#fff", color: a ? "#fff" : "#555", border: "1px solid " + (a ? "#7e22ce" : "rgba(0,0,0,.12)"), borderRadius: 999, padding: "8px 18px", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }) }),
  };

  if (!authed) return (
    <div style={{ ...S.wrap, maxWidth: 420, paddingTop: 90 }}>
      <div style={S.card}>
        <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>OA Personalshop — Admin</h1>
        <p style={{ fontSize: 13, color: "#777", margin: "0 0 16px" }}>Klistra in din ADMIN_SECRET.</p>
        <input style={S.inp} type="password" value={secret} onChange={(e) => setSecret(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadTenants()} placeholder="ADMIN_SECRET" />
        <button style={S.btn} onClick={() => loadTenants()}>Logga in</button>
        {status && <p style={{ fontSize: 12.5, color: "#b91c1c" }}>{status}</p>}
      </div>
    </div>
  );

  const orderBadge: any = { processing: ["Behandlas", "#2563eb"], ready: ["Klar", "#15803d"], pending_attest: ["Väntar attest", "#d97706"], rejected: ["Avslagen", "#b91c1c"] };

  return (
    <div style={S.wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, letterSpacing: "-0.01em" }}>OA Personalshop — Admin</h1>
        {status && <span style={{ fontSize: 13, color: status.startsWith("Fel") ? "#b91c1c" : "#15803d", fontWeight: 600 }}>{status}</span>}
      </div>

      {/* Kundlista */}
      <div style={S.card}>
        <span style={S.label}>Kunder</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tenants.map((t) => (
            <button key={t.id} style={S.tab(sel?.id === t.id)} onClick={() => pick(t)}>{t.name}</button>
          ))}
          <button style={S.ghost} onClick={() => { setSel(null); setForm({ name: "", slug: "", logo_url: "", brand_color: "#7e22ce", welcome_text: "Välkommen till er personalshop!", order_model: "attest", quota_type: "kr", quota_value: 1500, attest_threshold: 2000, approver_email: "", contact_email: "", footer_lines: "" }); setTab("install"); }}>+ Ny kund</button>
        </div>
      </div>

      {(sel || form.name !== undefined) && (
        <>
          {sel && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {(["dashboard", "install", "utseende", "produkter", "personal", "ordrar"] as const).map((t) => (
                <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>
                  {{ dashboard: "📊 Dashboard", install: "Inställningar", utseende: "🎨 Utseende", produkter: `Produkter (${products.length})`, personal: `Personal (${staff.length})`, ordrar: `Ordrar (${orders.length})` }[t]}
                </button>
              ))}
              <a href={`/s/${sel.slug}`} target="_blank" style={{ ...S.ghost, textDecoration: "none", color: "#333", lineHeight: "18px" }}>Öppna butiken ↗</a>
            </div>
          )}

          {/* ===== Dashboard (riktig data ur ordrarna) ===== */}
          {sel && tab === "dashboard" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
                {[
                  ["Aktiva beställare", stats ? `${stats.kpi.activeStaff} av ${stats.kpi.totalStaff}` : "—", "senaste 84 d"],
                  ["Ordrar denna månad", stats ? String(stats.kpi.monthOrders) : "—", stats ? kr(stats.kpi.monthValue) : ""],
                  ["Väntar attest", stats ? String(stats.kpi.pending) : "—", stats && stats.kpi.pending > 0 ? "kräver chef" : "allt klart ✓"],
                  ["Kvotförbrukning", stats && stats.kpi.budgetPct !== null ? stats.kpi.budgetPct + " %" : "—", "av total årspott"],
                ].map(([t, v, d]: any) => (
                  <div key={t} style={S.card}>
                    <span style={S.label}>{t}</span>
                    <p style={{ fontSize: 24, fontWeight: 700, margin: "2px 0 2px" }}>{v}</p>
                    <p style={{ fontSize: 11.5, color: "#888", margin: 0 }}>{d}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
                <div style={S.card}>
                  <span style={S.label}>Ordrar per vecka (12 v)</span>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 110, marginTop: 8 }}>
                    {(stats?.weeks || Array(12).fill(0)).map((v: number, i: number) => {
                      const max = Math.max(1, ...(stats?.weeks || [1]));
                      return <div key={i} title={String(v)} style={{ flex: 1, height: Math.max(3, (v / max) * 100) + "px", borderRadius: "6px 6px 0 0", background: i === 11 ? sel.brand_color : "rgba(0,0,0,.15)" }} />;
                    })}
                  </div>
                </div>
                <div style={S.card}>
                  <span style={S.label}>Topprodukter</span>
                  {(stats?.top || []).map(([n, c]: any) => (
                    <div key={n} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,.05)" }}>
                      <span>{n}</span><strong>{c} st</strong>
                    </div>
                  ))}
                  {(!stats || stats.top.length === 0) && <p style={{ fontSize: 12.5, color: "#888" }}>Inga ordrar än.</p>}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16 }}>
                <div style={S.card}>
                  <span style={S.label}>Populära storlekar</span>
                  {(stats?.sizes || []).map(([sz, p]: any) => (
                    <div key={sz} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, padding: "5px 0" }}>
                      <span style={{ width: 32, color: "#666" }}>{sz}</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 99, background: "rgba(0,0,0,.08)", overflow: "hidden" }}>
                        <div style={{ width: p + "%", height: "100%", borderRadius: 99, background: sel.brand_color }} />
                      </div>
                      <span style={{ width: 36, textAlign: "right", color: "#888" }}>{p} %</span>
                    </div>
                  ))}
                  {(!stats || stats.sizes.length === 0) && <p style={{ fontSize: 12.5, color: "#888" }}>Inga storleksdata än.</p>}
                </div>
                <div style={S.card}>
                  <span style={S.label}>Senaste aktivitet</span>
                  {(stats?.activity || []).map((a: any) => (
                    <div key={a.ticket + a.when} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,.05)" }}>
                      <span>#{a.ticket} · {a.who}</span>
                      <span style={{ color: "#888", whiteSpace: "nowrap" }}>{kr(a.total)} · {a.status}</span>
                    </div>
                  ))}
                  {(!stats || stats.activity.length === 0) && <p style={{ fontSize: 12.5, color: "#888" }}>Ingen aktivitet än.</p>}
                </div>
              </div>
            </>
          )}

          {/* ===== Utseende — theme builder, publiceras direkt ===== */}
          {sel && tab === "utseende" && (
            <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16 }}>
              <div style={S.card}>
                <span style={S.label}>Primärfärg</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  {["#7e22ce", "#f59e0b", "#38bdf8", "#34d399", "#f472b6", "#0f172a"].map((c) => (
                    <button key={c} onClick={() => quickUpdate({ brand_color: c })} title={c}
                      style={{ width: 34, height: 34, borderRadius: 99, background: c, border: sel.brand_color === c ? "3px solid #111" : "2px solid rgba(0,0,0,.15)", cursor: "pointer" }} />
                  ))}
                </div>
                <span style={S.label}>Egen hex</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={{ ...S.inp, marginBottom: 0 }} value={form.brand_color || ""} onChange={(e) => setForm({ ...form, brand_color: e.target.value })} placeholder="#1d4ed8" />
                  <button style={S.ghost} onClick={() => quickUpdate({ brand_color: form.brand_color })}>Använd</button>
                </div>
                <div style={{ marginTop: 16 }}>
                  <span style={S.label}>Hörnradie: {form.radius ?? sel.radius ?? 20}px</span>
                  <input type="range" min={4} max={32} value={form.radius ?? sel.radius ?? 20} style={{ width: "100%" }}
                    onChange={(e) => setForm({ ...form, radius: e.target.value })}
                    onMouseUp={() => quickUpdate({ radius: form.radius })}
                    onTouchEnd={() => quickUpdate({ radius: form.radius })} />
                </div>
                <div style={{ marginTop: 14 }}>
                  <span style={S.label}>Beställningsmodell</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[["free", "Fri"], ["attest", "Attest"], ["quota", "Kvot"]].map(([v, l]) => (
                      <button key={v} style={S.tab(sel.order_model === v)} onClick={() => quickUpdate({ order_model: v })}>{l}</button>
                    ))}
                  </div>
                </div>
                <p style={{ fontSize: 11, color: "#999", marginTop: 14 }}>Allt här publiceras direkt — personalen ser nya utseendet vid nästa sidladdning.</p>
              </div>
              <div style={S.card}>
                <span style={S.label}>Förhandsvisning</span>
                <div style={{ background: "#0b0e13", borderRadius: 18, padding: 22, marginTop: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: form.brand_color || sel.brand_color, color: "#0b0e13", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>
                      {(sel.name || "AB").split(/\s+/).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                    <span style={{ color: "#fff", fontWeight: 600, fontSize: 14.5 }}>{sel.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ background: form.brand_color || sel.brand_color, color: "#0b0e13", borderRadius: 99, padding: "8px 16px", fontSize: 12, fontWeight: 700 }}>Beställ nytt</span>
                    <span style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "#fff", borderRadius: Number(form.radius ?? sel.radius ?? 20), padding: "8px 16px", fontSize: 12, fontWeight: 600 }}>Kort med er radie</span>
                  </div>
                </div>
                <a href={`/s/${sel.slug}`} target="_blank" style={{ ...S.ghost, display: "inline-block", marginTop: 12, textDecoration: "none", color: "#333" }}>Öppna butiken och se live ↗</a>
              </div>
            </div>
          )}

          {/* ===== Inställningar — HÄR bor allt kundunikt ===== */}
          {tab === "install" && (
            <div style={S.card}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div><span style={S.label}>Företagsnamn</span><input style={S.inp} value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><span style={S.label}>Slug (adress: /s/slug)</span><input style={S.inp} value={form.slug || ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="acmebygg" /></div>
                <div><span style={S.label}>Logotyp-URL (valfri)</span><input style={S.inp} value={form.logo_url || ""} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://…/logo.png" /></div>
                <div><span style={S.label}>Profilfärg</span><input style={S.inp} value={form.brand_color || ""} onChange={(e) => setForm({ ...form, brand_color: e.target.value })} placeholder="#1d4ed8" /></div>
              </div>
              <span style={S.label}>Välkomsttext</span>
              <input style={S.inp} value={form.welcome_text || ""} onChange={(e) => setForm({ ...form, welcome_text: e.target.value })} />

              <span style={S.label}>Beställningsmodell</span>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                {[["free", "Fritt — order går direkt"], ["attest", "Attest — chef godkänner"], ["quota", "Kvot — per anställd/år"]].map(([v, l]) => (
                  <button key={v} style={S.tab(form.order_model === v)} onClick={() => setForm({ ...form, order_model: v })}>{l}</button>
                ))}
              </div>
              {form.order_model === "attest" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div><span style={S.label}>Attest krävs över (kr, 0 = alla ordrar)</span><input style={S.inp} type="number" value={form.attest_threshold ?? 0} onChange={(e) => setForm({ ...form, attest_threshold: e.target.value })} /></div>
                  <div><span style={S.label}>Attestansvarigs e-post</span><input style={S.inp} value={form.approver_email || ""} onChange={(e) => setForm({ ...form, approver_email: e.target.value })} /></div>
                </div>
              )}
              {form.order_model === "quota" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div><span style={S.label}>Kvottyp</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button style={S.tab(form.quota_type === "kr")} onClick={() => setForm({ ...form, quota_type: "kr" })}>Kronor</button>
                      <button style={S.tab(form.quota_type === "items")} onClick={() => setForm({ ...form, quota_type: "items" })}>Antal plagg</button>
                    </div>
                  </div>
                  <div><span style={S.label}>Kvot per anställd och år</span><input style={S.inp} type="number" value={form.quota_value ?? 0} onChange={(e) => setForm({ ...form, quota_value: e.target.value })} /></div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 4 }}>
                <div><span style={S.label}>Ordernotiser till (t.ex. din produktion)</span><input style={S.inp} value={form.contact_email || ""} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
                <div><span style={S.label}>Sidfotsrader i mejl (en per rad)</span><textarea style={{ ...S.inp, minHeight: 60 }} value={form.footer_lines || ""} onChange={(e) => setForm({ ...form, footer_lines: e.target.value })} /></div>
              </div>
              <button style={S.btn} onClick={() => saveTenant(!sel)}>{sel ? "Spara ändringar" : "Skapa kund"}</button>
            </div>
          )}

          {/* ===== Produkter ===== */}
          {sel && tab === "produkter" && (
            <>
              <div style={S.card}>
                <span style={S.label}>Ny produkt / redigera</span>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                  <input style={S.inp} placeholder="Namn" value={pForm.name || ""} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} />
                  <input style={S.inp} placeholder="Kategori" value={pForm.category || ""} onChange={(e) => setPForm({ ...pForm, category: e.target.value })} />
                  <input style={S.inp} placeholder="Pris (kr)" type="number" value={pForm.price ?? ""} onChange={(e) => setPForm({ ...pForm, price: e.target.value })} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 12 }}>
                  <input style={S.inp} placeholder="Storlekar: S,M,L,XL" value={pForm.sizes || ""} onChange={(e) => setPForm({ ...pForm, sizes: e.target.value })} />
                  <input style={S.inp} placeholder="Bild-URL (valfri)" value={pForm.image_url || ""} onChange={(e) => setPForm({ ...pForm, image_url: e.target.value })} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <input style={{ ...S.inp, flex: 1 }} placeholder="Färg: #334155" value={pForm.color || ""} onChange={(e) => setPForm({ ...pForm, color: e.target.value })} />
                    <select style={{ ...S.inp, flex: 1 }} value={pForm.shape || "tee"} onChange={(e) => setPForm({ ...pForm, shape: e.target.value })}>
                      <option value="jacket">Jacka</option><option value="hoodie">Hoodie</option><option value="tee">T-shirt</option>
                      <option value="pants">Byxor</option><option value="beanie">Mössa</option><option value="vest">Väst</option>
                    </select>
                  </div>
                </div>
                <button style={S.btn} onClick={saveProduct}>{pForm.id ? "Spara produkt" : "Lägg till produkt"}</button>
                {pForm.id && <button style={{ ...S.ghost, marginLeft: 8 }} onClick={() => setPForm({})}>Avbryt</button>}
              </div>
              <div style={S.card}>
                {products.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                    <span style={{ width: 34, height: 34, borderRadius: 9, background: p.image_url ? `url(${p.image_url}) center/cover` : p.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{!p.image_url && p.name[0]}</span>
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{p.name} <span style={{ color: "#999", fontWeight: 400 }}>· {p.category} · {kr(p.price)}{p.sizes?.length ? " · " + p.sizes.join("/") : ""}</span></span>
                    <button style={S.ghost} onClick={() => setPForm({ ...p, sizes: (p.sizes || []).join(",") })}>Redigera</button>
                    <button style={{ ...S.ghost, color: "#b91c1c" }} onClick={() => delProduct(p.id)}>Ta bort</button>
                  </div>
                ))}
                {products.length === 0 && <p style={{ fontSize: 13, color: "#888" }}>Inga produkter än — lägg till ovan.</p>}
              </div>
            </>
          )}

          {/* ===== Personal ===== */}
          {sel && tab === "personal" && (
            <>
              <div style={S.card}>
                <span style={S.label}>Lägg till personal — en per rad: "Anna Andersson anna@foretaget.se" eller bara e-post</span>
                <textarea style={{ ...S.inp, minHeight: 110 }} value={staffList} onChange={(e) => setStaffList(e.target.value)} placeholder={"Anna Andersson anna@acmebygg.se\nmicke@acmebygg.se"} />
                <button style={S.btn} onClick={addStaff}>Lägg till</button>
              </div>
              <div style={S.card}>
                {staff.map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,.06)", fontSize: 13.5 }}>
                    <span style={{ flex: 1 }}><strong>{s.name || "—"}</strong> <span style={{ color: "#888" }}>{s.email}</span></span>
                    {sel.order_model === "quota" && <span style={{ fontSize: 12, color: "#666" }}>Använt: {sel.quota_type === "items" ? s.used_items + " plagg" : kr(s.used_kr)}</span>}
                    <button style={{ ...S.ghost, background: s.role === "manager" ? "#7e22ce" : "#fff", color: s.role === "manager" ? "#fff" : "#333" }}
                      onClick={() => setRole(s.id, s.role === "manager" ? "employee" : "manager")}>
                      {s.role === "manager" ? "✓ Chef" : "Gör till chef"}
                    </button>
                    <button style={{ ...S.ghost, color: "#b91c1c" }} onClick={() => delStaff(s.id)}>Ta bort</button>
                  </div>
                ))}
                {staff.length === 0 && <p style={{ fontSize: 13, color: "#888" }}>Ingen personal registrerad — endast registrerade adresser kan logga in.</p>}
              </div>
            </>
          )}

          {/* ===== Ordrar ===== */}
          {sel && tab === "ordrar" && (
            <div style={S.card}>
              {orders.map((o) => (
                <div key={o.id} style={{ padding: "12px 0", borderBottom: "1px solid rgba(0,0,0,.06)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <strong style={{ fontSize: 13.5 }}>#{o.ticket}</strong>
                    <span style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>{o.who}{o.cost_center ? " · " + o.cost_center : ""} · {new Date(o.created_at).toLocaleDateString("sv-SE")}</span>
                    <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#555" }}>{o.items.join(", ")}{o.note ? " — ”" + o.note + "”" : ""}</p>
                  </div>
                  <strong style={{ fontSize: 13.5 }}>{kr(o.total)}</strong>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: (orderBadge[o.status] || ["", "#666"])[1] }}>{(orderBadge[o.status] || [o.status])[0]}</span>
                  {o.status === "processing" && <button style={S.ghost} onClick={() => setOrderStatus(o.id, "ready")}>Markera klar</button>}
                </div>
              ))}
              {orders.length === 0 && <p style={{ fontSize: 13, color: "#888" }}>Inga ordrar än.</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
