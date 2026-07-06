"use client";
import { useEffect, useState } from "react";

const kr = (n: number) => new Intl.NumberFormat("sv-SE").format(n) + " kr";

export default function Admin() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [tab, setTab] = useState<"install" | "produkter" | "personal" | "ordrar">("install");
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
    setSel(t); setTab("install");
    setForm({ ...t, footer_lines: (t.footer_lines || []).join("\n") });
    loadProducts(t.id); loadStaff(t.id); loadOrders(t.id);
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
              {(["install", "produkter", "personal", "ordrar"] as const).map((t) => (
                <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>
                  {{ install: "Inställningar", produkter: `Produkter (${products.length})`, personal: `Personal (${staff.length})`, ordrar: `Ordrar (${orders.length})` }[t]}
                </button>
              ))}
              <a href={`/s/${sel.slug}`} target="_blank" style={{ ...S.ghost, textDecoration: "none", color: "#333", lineHeight: "18px" }}>Öppna butiken ↗</a>
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
                  <input style={S.inp} placeholder="Färg utan bild: #334155" value={pForm.color || ""} onChange={(e) => setPForm({ ...pForm, color: e.target.value })} />
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
