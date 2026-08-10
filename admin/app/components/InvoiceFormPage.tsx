"use client";
import { useState, useCallback, useEffect } from "react";
import type { InvoiceType, Item, Loyalty, Workshop } from "@/lib/supabase";
import { Icons, Field, CustomSelect, fmtRp } from "./ui";
import type { Pesanan } from "@/lib/supabase";

// ─── Draft Catatan ────────────────────────────────────────────────
type CatatanDraft = { id: string; nama: string; isi: string };

const DEFAULT_DRAFTS: CatatanDraft[] = [
  {
    id: "workshop-default",
    nama: "Workshop",
    isi: "Dengan melakukan pembayaran, peserta dianggap telah membaca dan menyetujui seluruh syarat dan ketentuan yang berlaku.\n\nPeserta yang telah melakukan pembayaran namun berhalangan hadir wajib menginformasikan kepada penyelenggara paling lambat H-2 sebelum workshop. Apabila tidak ada konfirmasi hingga melewati batas waktu tersebut atau peserta tidak hadir, maka biaya yang telah dibayarkan dinyatakan hangus (non-refundable).",
  },
];

const DRAFTS_KEY = "invoice_catatan_drafts";

function loadDrafts(): CatatanDraft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (!raw) return DEFAULT_DRAFTS;
    const parsed: CatatanDraft[] = JSON.parse(raw);
    // Pastikan default draft selalu ada
    const hasDefault = parsed.some(d => d.id === "workshop-default");
    return hasDefault ? parsed : [DEFAULT_DRAFTS[0], ...parsed];
  } catch {
    return DEFAULT_DRAFTS;
  }
}

function saveDrafts(drafts: CatatanDraft[]) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

type LineItem = { item_id?: number; description: string; qty: number; satuan: string; harga_satuan: number };

type Props = {
  onSuccess: (invoiceId: number) => void;
  onCancel: () => void;
  prefillPesanan?: Pesanan | null;
};

const STATUS_OPTIONS = [
  { value: "UNPAID", label: "○ UNPAID", color: "#f87171" },
  { value: "DP", label: "◑ DP", color: "#fbbf24" },
  { value: "PAID", label: "✓ PAID", color: "#34d399" },
  { value: "CANCELLED", label: "✕ CANCELLED", color: "#94a3b8" },
];

export default function InvoiceFormPage({ onSuccess, onCancel, prefillPesanan }: Props) {
  const [types, setTypes] = useState<InvoiceType[]>([]);
  const [katalog, setKatalog] = useState<Item[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loyalties, setLoyalties] = useState<Loyalty[]>([]);
  const [saving, setSaving] = useState(false);
  const [showKatalog, setShowKatalog] = useState(false);
  const [katalogSearch, setKatalogSearch] = useState("");
  const [katalogFilter, setKatalogFilter] = useState<"ALL" | "PRODUK" | "WORKSHOP">("ALL");
  const [showLogbook, setShowLogbook] = useState(false);
  const [logbookSearch, setLogbookSearch] = useState("");
  const [saveToLogbook, setSaveToLogbook] = useState(false);

  // Draft catatan
  const [drafts, setDrafts] = useState<CatatanDraft[]>([]);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showAddDraft, setShowAddDraft] = useState(false);
  const [newDraftNama, setNewDraftNama] = useState("");
  const [newDraftIsi, setNewDraftIsi] = useState("");
  const [draftPreview, setDraftPreview] = useState<string | null>(null);

  useEffect(() => { setDrafts(loadDrafts()); }, []);

  const [form, setForm] = useState({
    invoice_type_id: "",
    invoice_date: new Date().toISOString().split("T")[0],
    customer_name: prefillPesanan?.nama ?? "",
    customer_contact: prefillPesanan?.no_hp ?? "",
    customer_address: prefillPesanan?.alamat ?? "",
    customer_email: "",
    discount: "0",
    status_pembayaran: "UNPAID",
    catatan: "",
    pesanan_id: prefillPesanan?.id ?? null,
  });
  const [items, setItems] = useState<LineItem[]>([]);

  const load = useCallback(async () => {
    const [typesRes, itemsRes, custRes, wsRes] = await Promise.all([
      fetch("/api/invoice-types"),
      fetch("/api/items"),
      fetch("/api/loyalty"),
      fetch("/api/workshops")
    ]);
    const t = await typesRes.json();
    setTypes(t);
    setKatalog(await itemsRes.json());
    if (custRes.ok) setLoyalties(await custRes.json());
    if (wsRes.ok) setWorkshops(await wsRes.json());
    if (t.length > 0) setForm(f => ({ ...f, invoice_type_id: String(t[0].id) }));
  }, []);

  useEffect(() => { load(); }, [load]);

  const addCustomItem = () => setItems(prev => [...prev, { description: "", qty: 1, satuan: "Pcs", harga_satuan: 0 }]);
  const addFromKatalog = (item: Item) => {
    const price = item.harga_promo ?? item.harga_normal;
    setItems(prev => [...prev, { item_id: item.id, description: item.nama, qty: 1, satuan: item.satuan, harga_satuan: price }]);
    setShowKatalog(false);
  };
  const updateItem = (idx: number, field: keyof LineItem, val: string | number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const pickCustomer = (c: Loyalty) => {
    setForm(f => ({
      ...f,
      customer_name: c.nama,
      customer_contact: c.no_hp ?? "",
      customer_address: c.alamat ?? "",
      customer_email: c.email ?? "",
    }));
    setShowLogbook(false);
    setLogbookSearch("");
  };

  const subtotal = items.reduce((s, it) => s + Number(it.qty) * Number(it.harga_satuan), 0);
  const discount = Number(form.discount) || 0;
  const grandTotal = subtotal - discount;

  const save = async () => {
    if (!form.invoice_type_id || !form.customer_name) return;
    setSaving(true);
    const payload = {
      invoice_type_id: Number(form.invoice_type_id),
      invoice_date: form.invoice_date,
      customer_name: form.customer_name,
      customer_contact: form.customer_contact || null,
      customer_address: form.customer_address || null,
      customer_email: form.customer_email || null,
      discount,
      status_pembayaran: form.status_pembayaran,
      catatan: form.catatan || null,
      pesanan_id: form.pesanan_id || null,
      subtotal,
      grand_total: grandTotal,
      items,
    };
    const res = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();

    // Auto-save customer to logbook if toggle is ON
    if (res.ok && saveToLogbook && form.customer_name.trim()) {
      await fetch("/api/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: form.customer_name,
          no_hp: form.customer_contact || null,
          email: form.customer_email || null,
          alamat: form.customer_address || null,
          catatan: null,
          is_active: true,
        }),
      });
    }

    setSaving(false);
    if (res.ok && data.id) onSuccess(data.id);
  };

  const typeOptions = types.map(t => ({ value: String(t.id), label: t.nama }));
  const filteredCustomers = loyalties.filter(c =>
    c.nama.toLowerCase().includes(logbookSearch.toLowerCase()) ||
    (c.no_hp ?? "").includes(logbookSearch) ||
    (c.email ?? "").toLowerCase().includes(logbookSearch.toLowerCase())
  );

  const activeKatalog = katalog.filter(k => k.is_active);
  const activeWorkshops = workshops.filter(w => w.is_active);
  
  const combinedItems = [
    ...activeKatalog.map(k => ({ type: 'product', id: k.id, nama: k.nama, icon: k.item_type?.icon ?? "📦", typeName: k.item_type?.nama ?? "Produk", stock: k.stock?.qty_available ?? 0, satuan: k.satuan, harga_normal: k.harga_normal, harga_promo: k.harga_promo })),
    ...activeWorkshops.map(w => ({ type: 'workshop', id: w.id, nama: w.nama_workshop, icon: "🎫", typeName: "Workshop", stock: "∞", satuan: "Tiket", harga_normal: w.harga_normal ? Number(w.harga_normal) : 0, harga_promo: w.harga_promo ? Number(w.harga_promo) : null }))
  ];

  const filteredKatalog = combinedItems.filter(item => {
    const matchSearch = item.nama.toLowerCase().includes(katalogSearch.toLowerCase());
    const matchType = katalogFilter === "ALL" ? true : katalogFilter === "PRODUK" ? item.type === "product" : item.type === "workshop";
    return matchSearch && matchType;
  });

  return (
    <div className="animate-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Buat Invoice Baru</h2>
          {prefillPesanan && <p style={{ fontSize: 13, color: "#a78bfa", marginTop: 4 }}>📦 Pre-fill dari pesanan #{prefillPesanan.id}: {prefillPesanan.produk}</p>}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}><Icons.X /> Batal</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Left - Customer & Invoice Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card" style={{ padding: 18 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 14, letterSpacing: "0.06em", textTransform: "uppercase" }}>Info Invoice</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Tipe Invoice" required>
                <CustomSelect value={form.invoice_type_id} onChange={v => setForm(f => ({ ...f, invoice_type_id: v }))} options={typeOptions.length ? typeOptions : [{ value: "", label: "— Pilih —" }]} />
              </Field>
              <Field label="Tanggal Invoice" required>
                <input className="input" type="date" value={form.invoice_date} onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
              </Field>
              <Field label="Status Pembayaran">
                <CustomSelect value={form.status_pembayaran} onChange={v => setForm(f => ({ ...f, status_pembayaran: v }))} options={STATUS_OPTIONS} />
              </Field>
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            {/* Card header with actions */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Data Customer</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Pick from logbook button */}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setShowLogbook(true); setLogbookSearch(""); }}
                  title="Pilih dari logbook"
                >
                  <Icons.Users /> Pilih dari Logbook
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Nama Customer" required>
                <input className="input" placeholder="Nama lengkap..." value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
              </Field>
              <Field label="No HP">
                <input className="input" placeholder="08xx..." value={form.customer_contact} onChange={e => setForm(f => ({ ...f, customer_contact: e.target.value }))} />
              </Field>
              <Field label="Email">
                <input className="input" type="email" placeholder="email@example.com" value={form.customer_email} onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))} />
              </Field>
              <Field label="Alamat">
                <textarea className="input" rows={2} placeholder="Alamat pengiriman (opsional)..." value={form.customer_address} onChange={e => setForm(f => ({ ...f, customer_address: e.target.value }))} />
              </Field>

              {/* Save to logbook toggle */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", borderRadius: 8,
                background: saveToLogbook ? "rgba(52,211,153,0.08)" : "var(--bg-card-2)",
                border: `1px solid ${saveToLogbook ? "rgba(52,211,153,0.25)" : "var(--border)"}`,
                transition: "all 0.2s",
              }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: saveToLogbook ? "#34d399" : "var(--text-secondary)" }}>
                    💾 Simpan ke Logbook Customer
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {saveToLogbook
                      ? "Data customer akan otomatis disimpan ke logbook setelah invoice dibuat"
                      : "Aktifkan untuk menyimpan data customer ke logbook"}
                  </p>
                </div>
                <div
                  className={`toggle ${saveToLogbook ? "on" : ""}`}
                  onClick={() => setSaveToLogbook(v => !v)}
                  style={{ flexShrink: 0 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right - Items */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Item / Produk</p>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowKatalog(true)}><Icons.Package /> Dari Katalog</button>
                <button className="btn btn-secondary btn-sm" onClick={addCustomItem}><Icons.Plus /> Custom</button>
              </div>
            </div>

            {items.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)", fontSize: 13 }}>
                <Icons.Receipt />
                <p style={{ marginTop: 8 }}>Belum ada item. Tambah dari katalog atau buat custom.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((it, idx) => (
                  <div key={idx} style={{ padding: 12, borderRadius: 8, background: "var(--bg-card-2)", border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input className="input" style={{ flex: 1 }} placeholder="Deskripsi item..." value={it.description} onChange={e => updateItem(idx, "description", e.target.value)} />
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeItem(idx)}><Icons.Trash /></button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "80px 80px 1fr", gap: 8 }}>
                      <input className="input" type="number" min="1" placeholder="Qty" value={it.qty} onChange={e => updateItem(idx, "qty", Number(e.target.value))} />
                      <input className="input" placeholder="Satuan" value={it.satuan} onChange={e => updateItem(idx, "satuan", e.target.value)} />
                      <input className="input" type="number" min="0" placeholder="Harga satuan" value={it.harga_satuan} onChange={e => updateItem(idx, "harga_satuan", Number(e.target.value))} />
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, textAlign: "right" }}>
                      Total: <strong style={{ color: "#a78bfa" }}>{fmtRp(Number(it.qty) * Number(it.harga_satuan))}</strong>
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Totals */}
            {items.length > 0 && (
              <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
                  <span>Subtotal</span><span>{fmtRp(subtotal)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--text-muted)", flex: 1 }}>Diskon</span>
                  <input className="input" style={{ width: 120, textAlign: "right" }} type="number" min="0" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", borderRadius: 8, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}>
                  <span style={{ fontWeight: 700, color: "#a78bfa", fontSize: 15 }}>Grand Total</span>
                  <span style={{ fontWeight: 700, color: "#a78bfa", fontSize: 15 }}>{fmtRp(grandTotal)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Catatan */}
          <div className="card" style={{ padding: 18 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Catatan</p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => { setShowDraftModal(true); setShowAddDraft(false); setDraftPreview(null); }}
                style={{ fontSize: 11, gap: 5 }}
              >
                <span style={{ fontSize: 13 }}>📋</span> Pilih Draft
              </button>
            </div>

            {/* Textarea */}
            <textarea
              className="input"
              rows={5}
              placeholder="Tulis catatan invoice, atau pilih dari draft di atas..."
              value={form.catatan}
              onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))}
              style={{ resize: "vertical" }}
            />

            {/* Hint chips draf */}
            {drafts.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {drafts.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, catatan: d.isi }))}
                    style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 11,
                      background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)",
                      color: "#a78bfa", cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
                    }}
                    title={`Klik untuk pakai draft: ${d.nama}`}
                  >
                    📋 {d.nama}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: "12px" }} onClick={save} disabled={saving || !form.invoice_type_id || !form.customer_name}>
            <Icons.Save /> {saving ? "Membuat Invoice..." : "Buat Invoice"}
          </button>
        </div>
      </div>

      {/* ── Katalog Modal ── */}
      {showKatalog && (
        <div className="modal-overlay" onClick={() => setShowKatalog(false)}>
          <div className="modal-box" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <h3 style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>Pilih dari Katalog & Workshop</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowKatalog(false)}><Icons.X /></button>
            </div>
            {/* Search in katalog */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}>
                  <Icons.Search />
                </span>
                <input
                  className="input"
                  style={{ paddingLeft: 34 }}
                  placeholder="Cari produk atau workshop..."
                  value={katalogSearch}
                  onChange={e => setKatalogSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {[
                  { id: "ALL", label: "Semua" },
                  { id: "PRODUK", label: "📦 Produk" },
                  { id: "WORKSHOP", label: "🎫 Workshop" }
                ].map(t => (
                  <button key={t.id} className={`btn btn-sm ${katalogFilter === t.id ? "btn-primary" : "btn-secondary"}`} onClick={() => setKatalogFilter(t.id as any)} style={{ borderRadius: 20 }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding: 16, maxHeight: "65vh", overflowY: "auto" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filteredKatalog.map(item => (
                  <div key={`${item.type}-${item.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: "var(--bg-card-2)", border: "1px solid var(--border)", cursor: "pointer", transition: "all 0.15s" }}
                    onClick={() => {
                        const price = item.harga_promo ?? item.harga_normal;
                        setItems(prev => [...prev, { item_id: item.type === 'product' ? item.id : undefined, description: item.nama, qty: 1, satuan: item.satuan, harga_satuan: price }]);
                        setShowKatalog(false);
                    }} className="catalog-row">
                    <span style={{ fontSize: 20 }}>{item.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{item.nama}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.typeName} • Stok: {item.stock} {item.satuan !== "Tiket" ? item.satuan : ""}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {item.harga_promo ? (
                        <>
                          <p style={{ fontWeight: 700, color: "#34d399" }}>{fmtRp(item.harga_promo)}</p>
                          <p style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "line-through" }}>{fmtRp(item.harga_normal)}</p>
                        </>
                      ) : <p style={{ fontWeight: 700, color: "var(--text-primary)" }}>{fmtRp(item.harga_normal)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Logbook Customer Modal ── */}
      {showLogbook && (
        <div className="modal-overlay" onClick={() => setShowLogbook(false)}>
          <div className="modal-box" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <div>
                <h3 style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>Pilih dari Logbook Customer</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{loyalties.length} customer tersedia</p>
              </div>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowLogbook(false)}><Icons.X /></button>
            </div>

            {/* Search in logbook */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}>
                  <Icons.Search />
                </span>
                <input
                  className="input"
                  style={{ paddingLeft: 34 }}
                  placeholder="Cari nama, HP, atau email..."
                  value={logbookSearch}
                  onChange={e => setLogbookSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div style={{ padding: 12, maxHeight: "55vh", overflowY: "auto" }}>
              {filteredCustomers.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                  <p style={{ fontSize: 13 }}>
                    {loyalties.length === 0 ? "Logbook masih kosong. Tambah customer terlebih dahulu." : "Tidak ada customer yang cocok."}
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {filteredCustomers.map(c => (
                    <div
                      key={c.id}
                      className="catalog-row"
                      onClick={() => pickCustomer(c)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "10px 14px", borderRadius: 8,
                        background: "var(--bg-card-2)", border: "1px solid var(--border)",
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                        background: `hsl(${(c.id * 47) % 360}, 60%, 20%)`,
                        border: `1px solid hsl(${(c.id * 47) % 360}, 60%, 40%)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 700,
                        color: `hsl(${(c.id * 47) % 360}, 80%, 70%)`,
                      }}>
                        {c.nama.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{c.nama}</p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          {[c.no_hp, c.email].filter(Boolean).join(" · ") || "Tidak ada kontak"}
                        </p>
                      </div>
                      {c.alamat && (
                        <p style={{ fontSize: 11, color: "var(--text-subtle)", maxWidth: 140, textAlign: "right" }}>
                          {c.alamat.length > 35 ? c.alamat.slice(0, 35) + "…" : c.alamat}
                        </p>
                      )}
                      <span style={{ color: "#34d399", flexShrink: 0 }}>
                        <Icons.UserCheck />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Draft Catatan Modal ── */}
      {showDraftModal && (
        <div className="modal-overlay" onClick={() => { setShowDraftModal(false); setShowAddDraft(false); }}>
          <div className="modal-box" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            {/* Header modal */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>📋 Draft Catatan</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Pilih template catatan atau tambah draft baru</p>
              </div>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => { setShowDraftModal(false); setShowAddDraft(false); }}><Icons.X /></button>
            </div>

            {/* Daftar draft */}
            <div style={{ padding: "12px 16px", maxHeight: "45vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {drafts.map(d => (
                <div
                  key={d.id}
                  style={{
                    borderRadius: 10, border: "1px solid var(--border)",
                    background: draftPreview === d.id ? "rgba(124,58,237,0.08)" : "var(--bg-card-2)",
                    borderColor: draftPreview === d.id ? "rgba(124,58,237,0.35)" : "var(--border)",
                    overflow: "hidden", transition: "all 0.15s",
                  }}
                >
                  {/* Draft header row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
                    <span style={{ fontSize: 18 }}>📋</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{d.nama}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {d.isi.slice(0, 80)}{d.isi.length > 80 ? "…" : ""}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11 }}
                        onClick={() => setDraftPreview(draftPreview === d.id ? null : d.id)}
                      >
                        {draftPreview === d.id ? "Tutup" : "Preview"}
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: 11 }}
                        onClick={() => { setForm(f => ({ ...f, catatan: d.isi })); setShowDraftModal(false); setShowAddDraft(false); }}
                      >
                        Pakai
                      </button>
                      <button
                          className="btn btn-danger btn-sm btn-icon"
                          onClick={() => {
                            const next = drafts.filter(x => x.id !== d.id);
                            setDrafts(next);
                            saveDrafts(next);
                            if (draftPreview === d.id) setDraftPreview(null);
                          }}
                          title="Hapus draft"
                        >
                          <Icons.Trash />
                        </button>
                    </div>
                  </div>

                  {/* Preview isi */}
                  {draftPreview === d.id && (
                    <div style={{ padding: "10px 14px 12px", borderTop: "1px solid var(--border)", background: "rgba(0,0,0,0.12)" }}>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "pre-line", lineHeight: 1.6 }}>{d.isi}</p>
                    </div>
                  )}
                </div>
              ))}

              {drafts.length === 0 && (
                <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>📭</p>
                  <p style={{ fontSize: 13 }}>Belum ada draft. Tambah draft pertamamu!</p>
                </div>
              )}
            </div>

            {/* Form tambah draft baru */}
            <div style={{ borderTop: "1px solid var(--border)", padding: "14px 20px" }}>
              {!showAddDraft ? (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => { setShowAddDraft(true); setNewDraftNama(""); setNewDraftIsi(""); }}
                >
                  <Icons.Plus /> Tambahkan Draft Baru
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Draft Baru</p>
                  <input
                    className="input"
                    placeholder="Nama draft (mis: Workshop, Produk, dll)..."
                    value={newDraftNama}
                    onChange={e => setNewDraftNama(e.target.value)}
                    autoFocus
                  />
                  <textarea
                    className="input"
                    rows={4}
                    placeholder="Isi template catatan..."
                    value={newDraftIsi}
                    onChange={e => setNewDraftIsi(e.target.value)}
                    style={{ resize: "vertical" }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1, justifyContent: "center" }}
                      disabled={!newDraftNama.trim() || !newDraftIsi.trim()}
                      onClick={() => {
                        const next: CatatanDraft[] = [
                          ...drafts,
                          { id: `draft-${Date.now()}`, nama: newDraftNama.trim(), isi: newDraftIsi.trim() },
                        ];
                        setDrafts(next);
                        saveDrafts(next);
                        setShowAddDraft(false);
                        setNewDraftNama("");
                        setNewDraftIsi("");
                      }}
                    >
                      <Icons.Save /> Simpan Draft
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowAddDraft(false)}>Batal</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
