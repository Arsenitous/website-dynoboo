"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { KnowledgeBase, Workshop, Pesanan, ChatLog, PilihanJawaban, AdminUser, Invoice, Item } from "@/lib/supabase";

// ─── Import components ────────────────────────────────────────────────────────
import { Icons, CustomSelect, Modal, StatCard, Field, InvoiceStatusBadge, fmtRp, ToastProvider, useToast, SortIcon } from "./components/ui";
import { useSort } from "@/lib/useSort";
import KatalogPage from "./components/KatalogPage";
import StokPage from "./components/StokPage";
import InvoiceListPage from "./components/InvoiceListPage";
import InvoiceFormPage from "./components/InvoiceFormPage";
import InvoiceDetailPage from "./components/InvoiceDetailPage";
import CompanyPage from "./components/CompanyPage";
import AiAssistantPage from "./components/AiAssistantPage";
import LoyaltyPage from "./components/LoyaltyPage";
import MonthlyReportPage from "./components/MonthlyReportPage";
import { AccessContext, useAccess } from "./components/AccessContext";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Page =
  | "dashboard"
  | "katalog" | "stok"
  | "invoice-list" | "invoice-form" | "invoice-detail" | "invoice-types"
  | "loyalty" | "laporan-penjualan"
  | "knowledge" | "workshops" | "pesanan" | "riwayat-pesanan" | "chatlogs"
  | "company" | "access" | "ai-assistant" | "manual";

// ─── Navigation Structure ──────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    key: "MENU",
    items: [{ id: "dashboard", label: "Dashboard", icon: <Icons.Dashboard /> }],
  },
  {
    key: "INVOICE",
    sub: [
      {
        label: "Transaksi",
        items: [
          { id: "invoice-list", label: "Daftar Invoice", icon: <Icons.Receipt /> },
          { id: "invoice-form", label: "Buat Invoice", icon: <Icons.Plus /> },
        ],
      },
      {
        label: "Laporan",
        items: [
          { id: "laporan-penjualan", label: "Laporan Penjualan", icon: <Icons.BarChart /> },
        ],
      },
      {
        label: "Pengaturan",
        items: [{ id: "invoice-types", label: "Tipe Invoice", icon: <Icons.FileText /> }],
      },
    ],
  },
  {
    key: "PRODUK & WS",
    sub: [
      { 
        label: "Master", 
        items: [
          { id: "katalog", label: "Katalog Produk", icon: <Icons.Package /> },
          { id: "workshops", label: "Workshops", icon: <Icons.Workshop /> }
        ] 
      },
      { label: "Stok", items: [{ id: "stok", label: "Stok & Kuota", icon: <Icons.BarChart /> }] },
    ],
  },
  {
    key: "LOYALTY",
    items: [
      { id: "loyalty", label: "Loyalty Logbook", icon: <Icons.Users /> },
    ],
  },
  // {
  //   key: "CHATBOT",
  //   sub: [
  //     {
  //       label: "Data Bot",
  //       items: [
  //         { id: "knowledge", label: "Knowledge Base", icon: <Icons.Brain /> },
  //       ],
  //     },
  //     {
  //       label: "Aktivitas",
  //       items: [
  //         { id: "pesanan", label: "Pesanan (Pre-order)", icon: <Icons.Orders /> },
  //         { id: "riwayat-pesanan", label: "Riwayat Pesanan", icon: <Icons.CheckCircle /> },
  //         { id: "chatlogs", label: "Chat Logs", icon: <Icons.Chat /> },
  //       ],
  //     },
  //   ],
  // },
  {
    key: "PENGATURAN",
    items: [
      { id: "company", label: "Profil Toko", icon: <Icons.Building /> },
      { id: "access", label: "Access Control", icon: <Icons.Lock /> },
    ],
  },
  {
    key: "EXTRA",
    items: [
      { id: "ai-assistant", label: "AI Assistant", icon: <span style={{fontSize:14}}>🦖</span> },
      { id: "manual", label: "Buku Panduan", icon: <Icons.Book /> },
    ],
  },
];

// ─── Group accent colours ───────────────────────────────────────────────────────
const GROUP_META: Record<string, { color: string; bg: string; emoji: string }> = {
  MENU:          { color: "#38bdf8", bg: "rgba(56,189,248,0.18)",  emoji: "🏠" },
  "PRODUK & WS": { color: "#a78bfa", bg: "rgba(167,139,250,0.18)", emoji: "📦" },
  INVOICE:       { color: "#38bdf8", bg: "rgba(56,189,248,0.18)",  emoji: "🧾" },
  LOYALTY:      { color: "#fb7185", bg: "rgba(251,113,133,0.18)", emoji: "👥" },
  // CHATBOT:       { color: "#34d399", bg: "rgba(52,211,153,0.18)",  emoji: "🤖" },
  PENGATURAN:    { color: "#f59e0b", bg: "rgba(245,158,11,0.18)",  emoji: "⚙️" },
  EXTRA:         { color: "#38bdf8", bg: "rgba(56,189,248,0.18)",  emoji: "📌" },
};

function SidebarGroup({ group, currentPage, onNavigate }: { group: typeof NAV_GROUPS[number]; currentPage: Page; onNavigate: (page: Page) => void }) {
  const isActive = (id: string) => currentPage === id || (currentPage === "invoice-detail" && id === "invoice-list");

  const hasActiveChild =
    group.items?.some(i => isActive(i.id)) ||
    group.sub?.some(s => s.items.some(i => isActive(i.id)));

  const [open, setOpen] = useState(true);
  const meta = GROUP_META[group.key] || { color: "#38bdf8", bg: "rgba(56,189,248,0.18)", emoji: "📌" };

  const getItemStyle = (active: boolean) => {
    if (active) {
      return {
        width: "100%",
        border: `1px solid ${meta.color}40`,
        background: meta.bg,
        color: meta.color,
        fontWeight: 600,
        boxShadow: `0 0 12px ${meta.color}20`,
        transition: "all 0.15s ease",
      };
    }
    return {
      width: "100%",
      border: "1px solid transparent",
      background: "none",
      transition: "all 0.15s ease",
    };
  };

  // MENU or EXTRA group — no toggle
  if (group.key === "MENU" || group.key === "EXTRA") {
    return (
      <div style={{ marginBottom: 6 }}>
        {group.items?.map((item) => {
          const active = isActive(item.id);
          return (
            <button key={item.id} className={`nav-item ${active ? "active" : ""}`}
              style={getItemStyle(active)}
              onClick={() => onNavigate(item.id as Page)}>
              {item.icon}<span>{item.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 4 }}>
      {/* ── Premium section header ── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", border: "none", outline: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 10px 7px 8px", borderRadius: 10, marginTop: 6,
          background: hasActiveChild ? "var(--bg-card-2)" : "transparent",
          borderLeft: `3px solid ${meta.color}`,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = hasActiveChild ? "var(--bg-card-2)" : "transparent"; }}
      >
        {/* Emoji icon badge */}
        <span style={{
          width: 22, height: 22, borderRadius: 6,
          background: meta.bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, flexShrink: 0, transition: "all 0.2s",
          boxShadow: `0 0 8px ${meta.color}40`,
        }}>{meta.emoji}</span>

        <span style={{
          flex: 1, fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
          textTransform: "uppercase", textAlign: "left",
          color: meta.color,
          transition: "color 0.2s",
        }}>{group.key}</span>

        {/* Chevron */}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke={meta.color}
          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: "transform 0.22s ease", transform: open ? "rotate(0deg)" : "rotate(-90deg)", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ── Collapsible content ── */}
      <div className={`nav-group-content ${open ? "" : "collapsed"}`}
        style={{ paddingLeft: 4 }}>
        {group.items?.map((item) => {
          const active = isActive(item.id);
          return (
            <button key={item.id} className={`nav-item ${active ? "active" : ""}`}
              style={getItemStyle(active)}
              onClick={() => onNavigate(item.id as Page)}>
              {item.icon}<span>{item.label}</span>
            </button>
          );
        })}
        {group.sub?.map((sub, si) => (
          <div key={si}>
            <p style={{ fontSize: 9, fontWeight: 700, color: "var(--text-subtle)", paddingLeft: 10, marginTop: 8, marginBottom: 2, letterSpacing: "0.08em", textTransform: "uppercase" }}>— {sub.label}</p>
            {sub.items.map((item) => {
              const active = isActive(item.id);
              return (
                <button key={item.id} className={`nav-item ${active ? "active" : ""}`}
                  style={{ ...getItemStyle(active), paddingLeft: 16 }}
                  onClick={() => onNavigate(item.id as Page)}>
                  {item.icon}<span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}


function fmtDate(d: string) {
  if (!d) return "—";
  // Plain date strings like "2026-12-25" should be parsed as local time
  // not as UTC midnight (which shifts the date in non-UTC timezones)
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [year, month, day] = d.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// ─── InvoiceTypes page ─────────────────────────────────────────────────────────
type InvoiceTypeRow = { id: number; nama: string; prefix: string; deskripsi: string | null; is_active: boolean };
function InvoiceTypesPage() {
  const hasAccess = useAccess();
  const canCreate = hasAccess("invoice", "create");
  const canUpdate = hasAccess("invoice", "update");
  const canDelete = hasAccess("invoice", "delete");
  const { showToast } = useToast();
  const [types, setTypes] = useState<InvoiceTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<InvoiceTypeRow | null>(null);
  const [form, setForm] = useState({ nama: "", prefix: "", deskripsi: "", is_active: true });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [deletingType, setDeletingType] = useState<InvoiceTypeRow | null>(null);
  const load = useCallback(async () => { setLoading(true); const r = await fetch("/api/invoice-types"); setTypes(await r.json()); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  
  const filteredTypes = types.filter(t => t.nama.toLowerCase().includes(search.toLowerCase()) || t.prefix.toLowerCase().includes(search.toLowerCase()) || (t.deskripsi || "").toLowerCase().includes(search.toLowerCase()));
  const { sortedItems: sortedTypes, handleSort, sortConfig } = useSort(filteredTypes);
  const openAdd = () => { setForm({ nama: "", prefix: "", deskripsi: "", is_active: true }); setAdding(true); setEditing(null); };
  const openEdit = (t: InvoiceTypeRow) => { setForm({ nama: t.nama, prefix: t.prefix, deskripsi: t.deskripsi ?? "", is_active: t.is_active }); setEditing(t); setAdding(false); };
  const save = async () => {
    if (editing) {
      await fetch(`/api/invoice-types/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      showToast("Tipe invoice berhasil diperbarui!");
    } else {
      await fetch("/api/invoice-types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      showToast("Tipe invoice berhasil ditambahkan!");
    }
    setSaving(false); setAdding(false); setEditing(null); load();
  };
  const del = async () => { 
    if (!deletingType) return;
    await fetch(`/api/invoice-types/${deletingType.id}`, { method: "DELETE" }); 
    showToast("Tipe invoice berhasil dihapus!");
    setDeletingType(null);
    load(); 
  };
  return (
    <div className="animate-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div><h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Tipe Invoice</h2><p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Kelola template jenis invoice (Workshop, Produk, Bouquet...)</p></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}><Icons.Search /></span>
            <input className="input" style={{ paddingLeft: 34, width: 220, height: 34, fontSize: 13 }} placeholder="Cari tipe..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={load}><Icons.Refresh /></button>
          {canCreate && <button className="btn btn-primary btn-sm" onClick={openAdd}><Icons.Plus /> Tambah Tipe</button>}
        </div>
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? <div style={{ padding: 20 }}><div className="skeleton" style={{ height: 52 }} /></div> : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("nama")}>Nama <SortIcon sortConfig={sortConfig} columnKey="nama" /></th>
                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("prefix")}>Prefix <SortIcon sortConfig={sortConfig} columnKey="prefix" /></th>
                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("deskripsi")}>Deskripsi <SortIcon sortConfig={sortConfig} columnKey="deskripsi" /></th>
                <th>Contoh No.</th>
                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("is_active")}>Status <SortIcon sortConfig={sortConfig} columnKey="is_active" /></th>
                {(canUpdate || canDelete) && <th style={{ width: 90 }}>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {sortedTypes.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t.nama}</td>
                  <td><code style={{ background: "rgba(56,189,248,0.12)", padding: "2px 8px", borderRadius: 4, color: "#38bdf8", fontSize: 12 }}>{t.prefix}</code></td>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{t.deskripsi ?? "—"}</td>
                  <td><code style={{ fontSize: 11, color: "#38bdf8" }}>DNB-{t.prefix}-2608-0001</code></td>
                  <td><span className={`badge ${t.is_active ? "badge-active" : "badge-closed"}`}>{t.is_active ? "Aktif" : "Nonaktif"}</span></td>
                  {(canUpdate || canDelete) && (
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {canUpdate && <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(t)}><Icons.Edit /></button>}
                        {canDelete && <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeletingType(t)}><Icons.Trash /></button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {types.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Belum ada tipe invoice</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      {(adding || !!editing) && (
        <Modal title={editing ? "Edit Tipe Invoice" : "Tambah Tipe Invoice"} onClose={() => { setAdding(false); setEditing(null); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Nama Tipe" required><input className="input" placeholder="Invoice Workshop" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} /></Field>
            <Field label="Prefix (maks 5 huruf)" required><input className="input" placeholder="WSP" maxLength={5} style={{ textTransform: "uppercase" }} value={form.prefix} onChange={e => setForm(f => ({ ...f, prefix: e.target.value.toUpperCase() }))} /></Field>
            <Field label="Deskripsi"><input className="input" placeholder="Untuk pembayaran workshop..." value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} /></Field>
            <Field label="Status"><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div className={`toggle ${form.is_active ? "on" : ""}`} onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))} /><span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{form.is_active ? "Aktif" : "Nonaktif"}</span></div></Field>
            {form.prefix && <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)", fontSize: 12, color: "#38bdf8" }}>Preview: <code>DNB-{form.prefix}-2608-0001</code></div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={saving || !form.nama || !form.prefix}><Icons.Save /> {saving ? "Menyimpan..." : "Simpan"}</button>
              <button className="btn btn-secondary" onClick={() => { setAdding(false); setEditing(null); }}>Batal</button>
            </div>
          </div>
        </Modal>
      )}

      {deletingType && (
        <Modal title="Hapus Tipe Invoice" onClose={() => setDeletingType(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>🗑️</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{deletingType.nama}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Prefix: {deletingType.prefix}</p>
                </div>
              </div>
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 13, color: "#f59e0b", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <span>Anda yakin ingin menghapus tipe invoice ini secara permanen?</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-sm" style={{ flex: 1, justifyContent: "center", background: "linear-gradient(135deg,rgba(239,68,68,0.2),rgba(220,38,38,0.15))", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)", padding: "10px 0", fontWeight: 700 }} onClick={del}>Ya, Hapus</button>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center", padding: "10px 0" }} onClick={() => setDeletingType(null)}>Batal</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Dashboard Stats (Grid Redesign) ───────────────────────────────────────────

function DashboardPage({ onNavigate }: { onNavigate: (page: Page, data?: unknown) => void }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pesanan, setPesanan] = useState<Pesanan[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [invRes, pesRes, itemsRes] = await Promise.all([
          fetch("/api/invoices"), fetch("/api/pesanan"), fetch("/api/items"),
        ]);
        if (invRes.ok) setInvoices(await invRes.json());
        if (pesRes.ok) setPesanan(await pesRes.json());
        if (itemsRes.ok) setItems(await itemsRes.json());
      } catch { /* silent */ }
      setLoading(false);
    };
    load();
  }, []);

  const totalPaidRevenue = invoices.filter(i => i.status_pembayaran === "PAID").reduce((s, i) => s + Number(i.grand_total), 0);
  const totalUnpaidAmount = invoices.filter(i => ["UNPAID", "DP"].includes(i.status_pembayaran)).reduce((s, i) => s + Number(i.sisa_tagihan), 0);

  const countPaid = invoices.filter(i => i.status_pembayaran === "PAID").length;
  const countDP = invoices.filter(i => i.status_pembayaran === "DP").length;
  const countUnpaid = invoices.filter(i => i.status_pembayaran === "UNPAID").length;
  const countCancelled = invoices.filter(i => i.status_pembayaran === "CANCELLED").length;

  const lowStockItems = items.filter(i => i.is_active && (i.stock?.qty_available ?? 0) <= 3);

  const recentInvoices = invoices.slice(0, 5);
  const { sortedItems: sortedRecentInvoices, handleSort: handleSortRecent, sortConfig: sortConfigRecent } = useSort(recentInvoices);

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }} className="gradient-text">Dashboard Semi-POS</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Ringkasan performa toko & transaksi DynoBoo</p>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", background: "var(--bg-card)", padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)" }}>
          🗓️ {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>

      {/* Top Grid - 4 KPI Cards */}
      <div className="dashboard-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard label="Revenue (PAID)" value={loading ? "—" : fmtRp(totalPaidRevenue)} color="#10b981" bg="rgba(16,185,129,0.15)" icon={<Icons.TrendingUp />} sub="Total dana masuk" />
        <StatCard label="Total Transaksi" value={loading ? "—" : (countPaid + countDP + countUnpaid)} color="#38bdf8" bg="rgba(56,189,248,0.15)" icon={<Icons.Receipt />} sub={`${countPaid} lunas, ${countUnpaid} belum`} />
        <StatCard label="Katalog Produk" value={loading ? "—" : items.length} color="#06b6d4" bg="rgba(6,182,212,0.15)" icon={<Icons.Package />} sub={`${lowStockItems.length} stok kritis`} />
        <StatCard label="Pesanan Pre-Order" value={loading ? "—" : pesanan.length} color="#f59e0b" bg="rgba(245,158,11,0.15)" icon={<Icons.Orders />} sub="dari chatbot" />
      </div>

      {/* Main 2-Column Grid */}
      <div className="dashboard-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 }}>
        
        {/* Left Column (60%) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* Quick Actions Widget - Neat compact buttons */}
          <div className="card" style={{ padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>Aksi Cepat POS</p>
            <div className="pos-actions-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
              <button className="btn btn-primary" style={{ padding: "8px 12px", justifyContent: "center", fontSize: 12, height: 38 }} onClick={() => onNavigate("invoice-form")}>
                <Icons.Plus /> <span>Buat Invoice</span>
              </button>
              <button className="btn btn-secondary" style={{ padding: "8px 12px", justifyContent: "center", fontSize: 12, height: 38 }} onClick={() => onNavigate("katalog")}>
                <Icons.Package /> <span>+ Produk</span>
              </button>
              <button className="btn btn-secondary" style={{ padding: "8px 12px", justifyContent: "center", fontSize: 12, height: 38 }} onClick={() => onNavigate("stok")}>
                <Icons.BarChart /> <span>Cek Stok</span>
              </button>
              <button className="btn btn-secondary" style={{ padding: "8px 12px", justifyContent: "center", fontSize: 12, height: 38 }} onClick={() => onNavigate("ai-assistant")}>
                <span style={{ fontSize: 14 }}>🦖</span> <span>Tanya AI</span>
              </button>
            </div>
          </div>

          {/* Recent Invoices Table Widget */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Transaksi Invoice Terbaru</p>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate("invoice-list")}>Semua Invoice →</button>
            </div>
            
            {invoices.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)", fontSize: 13 }}>
                Belum ada transaksi invoice recorded.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSortRecent("invoice_no")}>No Invoice <SortIcon sortConfig={sortConfigRecent} columnKey="invoice_no" /></th>
                      <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSortRecent("customer_name")}>Customer <SortIcon sortConfig={sortConfigRecent} columnKey="customer_name" /></th>
                      <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSortRecent("grand_total")}>Total <SortIcon sortConfig={sortConfigRecent} columnKey="grand_total" /></th>
                      <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSortRecent("status_pembayaran")}>Status <SortIcon sortConfig={sortConfigRecent} columnKey="status_pembayaran" /></th>
                      <th style={{ width: 60 }}>Lihat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRecentInvoices.map(inv => (
                      <tr key={inv.id} style={{ cursor: "pointer" }} onClick={() => onNavigate("invoice-list")}>
                        <td><span style={{ fontFamily: "monospace", fontSize: 11, color: "#38bdf8", fontWeight: 600 }}>{inv.invoice_no}</span></td>
                        <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{inv.customer_name}</td>
                        <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>{fmtRp(inv.grand_total)}</td>
                        <td><InvoiceStatusBadge status={inv.status_pembayaran} /></td>
                        <td><button className="btn btn-secondary btn-sm btn-icon"><Icons.Eye /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Right Column (40%) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* Stok Kritis Alert Widget */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Stok & Kuota Kritis (≤ 3)</p>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate("stok")}>Restock →</button>
            </div>
            
            {lowStockItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "14px 0", color: "#34d399", fontSize: 12 }}>
                ✓ Semua stok item dalam kondisi aman!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lowStockItems.slice(0, 3).map(item => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 12, color: "var(--text-primary)" }}>{item.nama}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Sisa: <strong style={{ color: "#f87171" }}>{item.stock?.qty_available ?? 0} {item.satuan}</strong></p>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => onNavigate("stok")}>Update</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pre-Orders Terbaru (Chatbot) */}
          {false && (
            <div className="card" style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Pesanan Pre-Order Chatbot</p>
                <button className="btn btn-secondary btn-sm" onClick={() => onNavigate("pesanan")}>Semua →</button>
              </div>

              {pesanan.length === 0 ? (
                <div style={{ textAlign: "center", padding: "14px 0", color: "var(--text-muted)", fontSize: 12 }}>
                  Belum ada pesanan pre-order masuk.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pesanan.slice(0, 2).map(p => (
                    <div key={p.id} style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-card-2)", border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
                        <p style={{ fontWeight: 600, fontSize: 12, color: "var(--text-primary)" }}>{p.nama}</p>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{fmtDate(p.created_at)}</span>
                      </div>
                      <p style={{ fontSize: 11, color: "#38bdf8", marginBottom: 6 }}>🛒 {p.produk}</p>
                      <button className="btn btn-primary btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => onNavigate("invoice-form", p)}>
                        <Icons.Receipt /> Process to Invoice
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Status Pembayaran breakdown (Moved below Chatbot pre-orders) */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Status Pembayaran</p>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate("invoice-list")}>Detail →</button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              <div style={{ padding: 10, borderRadius: 8, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="badge badge-paid" style={{ fontSize: 10 }}>PAID</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#10b981" }}>{countPaid}</span>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{fmtRp(totalPaidRevenue)}</p>
              </div>

              <div style={{ padding: 10, borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="badge badge-dp" style={{ fontSize: 10 }}>DP</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#f59e0b" }}>{countDP}</span>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Pelunasan</p>
              </div>

              <div style={{ padding: 10, borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="badge badge-unpaid" style={{ fontSize: 10 }}>UNPAID</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#ef4444" }}>{countUnpaid}</span>
                </div>
                <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{fmtRp(totalUnpaidAmount)}</p>
              </div>

              <div style={{ padding: 10, borderRadius: 8, background: "rgba(100,116,139,0.08)", border: "1px solid rgba(100,116,139,0.2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="badge badge-cancelled" style={{ fontSize: 10 }}>CANCELLED</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#94a3b8" }}>{countCancelled}</span>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Batal</p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

// ─── Knowledge, Workshops, Pesanan, ChatLogs, Access pages ────────────────────

function KnowledgePage() {
  const hasAccess = useAccess();
  const canCreate = hasAccess("chatbot", "create");
  const canUpdate = hasAccess("chatbot", "update");
  const canDelete = hasAccess("chatbot", "delete");
  const { showToast } = useToast();
  const [knowledges, setKnowledges] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<KnowledgeBase | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [deletingKnowledge, setDeletingKnowledge] = useState<KnowledgeBase | null>(null);
  const emptyForm = { keywords: "", jawaban_utama: "", pilihan_jawaban: [] as PilihanJawaban[], keterangan: "" };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/knowledge");
    setKnowledges(await r.json());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(emptyForm); setAdding(true); setEditing(null); };
  const openEdit = (k: KnowledgeBase) => {
    setForm({ keywords: k.keywords, jawaban_utama: k.jawaban_utama, pilihan_jawaban: k.pilihan_jawaban ?? [], keterangan: k.keterangan ?? "" });
    setEditing(k); setAdding(false);
  };
  const save = async () => {
    setSaving(true);
    const payload = { ...form, pilihan_jawaban: form.pilihan_jawaban.length ? form.pilihan_jawaban : null, edited_by: "superadmin" };
    if (editing) {
      await fetch(`/api/knowledge/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      showToast("Knowledge Base berhasil diperbarui!");
    } else {
      await fetch("/api/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      showToast("Knowledge Base berhasil ditambahkan!");
    }
    setSaving(false); setAdding(false); setEditing(null); load();
  };
  const del = async () => { 
    if (!deletingKnowledge) return;
    await fetch(`/api/knowledge/${deletingKnowledge.id}`, { method: "DELETE" }); 
    showToast("Knowledge Base berhasil dihapus!");
    setDeletingKnowledge(null);
    load(); 
  };
  const addChoice = () => setForm(f => ({ ...f, pilihan_jawaban: [...f.pilihan_jawaban, { opsi: "", jawaban: "" }] }));
  const updateChoice = (i: number, field: "opsi" | "jawaban", val: string) => setForm(f => ({ ...f, pilihan_jawaban: f.pilihan_jawaban.map((p, idx) => idx === i ? { ...p, [field]: val } : p) }));
  const removeChoice = (i: number) => setForm(f => ({ ...f, pilihan_jawaban: f.pilihan_jawaban.filter((_, idx) => idx !== i) }));

  const filtered = knowledges.filter(k => !search || k.keywords.toLowerCase().includes(search.toLowerCase()) || k.jawaban_utama.toLowerCase().includes(search.toLowerCase()));
  const { sortedItems: sortedFiltered, handleSort, sortConfig } = useSort(filtered);

  return (
    <div className="animate-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div><h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Knowledge Base</h2><p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{knowledges.length} entri tersimpan</p></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={load}><Icons.Refresh /></button>
          {canCreate && <button className="btn btn-primary btn-sm" onClick={openAdd}><Icons.Plus /> Tambah</button>}
        </div>
      </div>
      <div style={{ position: "relative", marginBottom: 16 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}><Icons.Search /></span>
        <input className="input" style={{ paddingLeft: 36 }} placeholder="Cari keyword atau jawaban..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52 }} />)}</div> : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("id")}># <SortIcon sortConfig={sortConfig} columnKey="id" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("keywords")}>Keywords <SortIcon sortConfig={sortConfig} columnKey="keywords" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("jawaban_utama")}>Jawaban Utama <SortIcon sortConfig={sortConfig} columnKey="jawaban_utama" /></th>
                  <th>Pilihan</th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("keterangan")}>Catatan <SortIcon sortConfig={sortConfig} columnKey="keterangan" /></th>
                  {(canUpdate || canDelete) && <th style={{ width: 90 }}>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {sortedFiltered.map(k => (
                  <tr key={k.id}>
                    <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{k.id}</td>
                    <td><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{k.keywords.split(",").map(kw => <span key={kw} className="badge badge-form" style={{ fontSize: 10 }}>{kw.trim()}</span>)}</div></td>
                    <td style={{ maxWidth: 300 }}><p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{k.jawaban_utama}</p></td>
                    <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{k.pilihan_jawaban?.length ?? 0} opsi</td>
                    <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{k.keterangan ?? "—"}</td>
                    {(canUpdate || canDelete) && (
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {canUpdate && <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(k)}><Icons.Edit /></button>}
                          {canDelete && <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeletingKnowledge(k)}><Icons.Trash /></button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Belum ada data</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {(adding || !!editing) && (
        <Modal title={editing ? "Edit Knowledge" : "Tambah Knowledge"} onClose={() => { setAdding(false); setEditing(null); }} wide>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Keywords (pisah dengan koma)" required><input className="input" placeholder="harga, biaya, berapa harga..." value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} /></Field>
            <Field label="Jawaban Utama" required><textarea className="input" rows={4} value={form.jawaban_utama} onChange={e => setForm(f => ({ ...f, jawaban_utama: e.target.value }))} /></Field>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Pilihan Jawaban (Opsional)</label>
                <button className="btn btn-secondary btn-sm" onClick={addChoice}><Icons.Plus /> Tambah Opsi</button>
              </div>
              {form.pilihan_jawaban.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input className="input" style={{ width: 120 }} placeholder="Label opsi" value={p.opsi} onChange={e => updateChoice(i, "opsi", e.target.value)} />
                  <input className="input" placeholder="Jawaban untuk opsi ini..." value={p.jawaban} onChange={e => updateChoice(i, "jawaban", e.target.value)} />
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeChoice(i)}><Icons.Trash /></button>
                </div>
              ))}
            </div>
            <Field label="Catatan Internal"><input className="input" placeholder="Catatan untuk admin..." value={form.keterangan} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} /></Field>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={saving || !form.keywords || !form.jawaban_utama}><Icons.Save /> {saving ? "Menyimpan..." : "Simpan"}</button>
              <button className="btn btn-secondary" onClick={() => { setAdding(false); setEditing(null); }}>Batal</button>
            </div>
          </div>
        </Modal>
      )}

      {deletingKnowledge && (
        <Modal title="Hapus Knowledge Base" onClose={() => setDeletingKnowledge(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>🗑️</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{deletingKnowledge.keywords}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{deletingKnowledge.jawaban_utama}</p>
                </div>
              </div>
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 13, color: "#f59e0b", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <span>Anda yakin ingin menghapus entri knowledge base ini?</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-sm" style={{ flex: 1, justifyContent: "center", background: "linear-gradient(135deg,rgba(239,68,68,0.2),rgba(220,38,38,0.15))", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)", padding: "10px 0", fontWeight: 700 }} onClick={del}>Ya, Hapus</button>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center", padding: "10px 0" }} onClick={() => setDeletingKnowledge(null)}>Batal</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function WorkshopsPage() {
  const hasAccess = useAccess();
  const canCreate = hasAccess("produk_ws", "create");
  const canUpdate = hasAccess("produk_ws", "update");
  const canDelete = hasAccess("produk_ws", "delete");
  const { showToast } = useToast();
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [editing, setEditing] = useState<Workshop | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingWorkshop, setDeletingWorkshop] = useState<Workshop | null>(null);
  const emptyForm = { nama_workshop: "", tanggal: "", harga_normal: "", harga_promo: "", fasilitas: "", status: "ACTIVE", is_active: true };
  const [form, setForm] = useState(emptyForm);
  const STATUS_OPTS = [{ value: "ACTIVE", label: "✓ Aktif", color: "#34d399" }, { value: "UPCOMING", label: "◷ Upcoming", color: "#fbbf24" }, { value: "CLOSED", label: "✕ Tutup", color: "#94a3b8" }];

  const load = useCallback(async () => { setLoading(true); const r = await fetch("/api/workshops"); setWorkshops(await r.json()); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  const openAdd = () => { setForm(emptyForm); setAdding(true); setEditing(null); };
  const openEdit = (w: Workshop) => { setForm({ nama_workshop: w.nama_workshop, tanggal: w.tanggal, harga_normal: w.harga_normal ?? "", harga_promo: w.harga_promo ?? "", fasilitas: w.fasilitas ?? "", status: w.status, is_active: w.is_active ?? true }); setEditing(w); setAdding(false); };
  const save = async () => {
    setSaving(true);
    const payload = { ...form, edited_by: "superadmin" };
    if (editing) {
      await fetch(`/api/workshops/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      showToast("Workshop berhasil diperbarui!");
    } else {
      await fetch("/api/workshops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      showToast("Workshop berhasil ditambahkan!");
    }
    setSaving(false); setAdding(false); setEditing(null); load();
  };
  const del = async () => { 
    if (!deletingWorkshop) return;
    await fetch(`/api/workshops/${deletingWorkshop.id}`, { method: "DELETE" }); 
    showToast("Workshop berhasil dihapus!");
    setDeletingWorkshop(null);
    load(); 
  };

  const filteredWorkshops = workshops.filter(w => {
    const matchesSearch = w.nama_workshop.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "ALL" ? true : filterStatus === "ACTIVE" ? w.is_active : !w.is_active;
    return matchesSearch && matchesStatus;
  });
  const { sortedItems: sortedWorkshops, handleSort, sortConfig } = useSort(filteredWorkshops);

  return (
    <div className="animate-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div><h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Workshops</h2><p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{workshops.length} workshop terdaftar</p></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={load}><Icons.Refresh /> Refresh</button>
          {canCreate && <button className="btn btn-primary btn-sm" onClick={openAdd}><Icons.Plus /> Tambah Workshop</button>}
        </div>
      </div>
      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { id: "ALL", label: "Total Workshop", val: workshops.length, color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
          { id: "ACTIVE", label: "Aktif", val: workshops.filter(c => c.is_active).length, color: "#34d399", bg: "rgba(52,211,153,0.12)" },
          { id: "INACTIVE", label: "Non-aktif", val: workshops.filter(c => !c.is_active).length, color: "#f87171", bg: "rgba(239,68,68,0.12)" },
        ].map(s => {
          const isActive = filterStatus === s.id;
          return (
            <div
              key={s.id}
              className="card"
              style={{
                padding: "14px 16px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                border: isActive ? `1.5px solid ${s.color}` : "1px solid var(--border)",
                boxShadow: isActive ? `0 0 16px ${s.color}30` : "none",
                background: isActive ? `${s.color}10` : "var(--bg-card)",
              }}
              onClick={() => setFilterStatus(s.id as any)}
              title={`Klik untuk memfilter: ${s.label}`}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.val}</p>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${s.color}20`, color: s.color }}>
                  {isActive ? "Aktif" : "Lihat →"}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}>
            <Icons.Search />
          </span>
          <input
            className="input"
            style={{ paddingLeft: 36, width: "100%", height: 38 }}
            placeholder="Cari nama workshop..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? <div style={{ padding: 20 }}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8 }} />)}</div> : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("id")}># <SortIcon sortConfig={sortConfig} columnKey="id" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("nama_workshop")}>Nama Workshop <SortIcon sortConfig={sortConfig} columnKey="nama_workshop" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("tanggal")}>Tanggal <SortIcon sortConfig={sortConfig} columnKey="tanggal" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("harga_normal")}>Harga Normal <SortIcon sortConfig={sortConfig} columnKey="harga_normal" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("harga_promo")}>Harga Promo <SortIcon sortConfig={sortConfig} columnKey="harga_promo" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("fasilitas")}>Fasilitas <SortIcon sortConfig={sortConfig} columnKey="fasilitas" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("status_event")}>Status Event <SortIcon sortConfig={sortConfig} columnKey="status_event" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("is_active")}>Status Aktif <SortIcon sortConfig={sortConfig} columnKey="is_active" /></th>
                  {(canUpdate || canDelete) && <th style={{ width: 90 }}>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {sortedWorkshops.map(w => (
                  <tr key={w.id}>
                    <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{w.id}</td>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{w.nama_workshop}</td>
                    <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(w.tanggal)}</td>
                    <td>{w.harga_normal ? <span style={{ fontWeight: 600 }}>{w.harga_normal}</span> : "—"}</td>
                    <td>{w.harga_promo ? <span style={{ color: "#34d399", fontWeight: 600 }}>{w.harga_promo}</span> : "—"}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: 12, maxWidth: 200 }}><span style={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{w.fasilitas ?? "—"}</span></td>
                    <td><span className={`badge ${w.status === "ACTIVE" ? "badge-active" : w.status === "UPCOMING" ? "badge-upcoming" : "badge-closed"}`}>{w.status}</span></td>
                    <td><span className={`badge ${w.is_active ? "badge-active" : "badge-closed"}`}>{w.is_active ? "Aktif" : "Nonaktif"}</span></td>
                    {(canUpdate || canDelete) && (
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {canUpdate && <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(w)}><Icons.Edit /></button>}
                          {canDelete && <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeletingWorkshop(w)}><Icons.Trash /></button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {workshops.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Belum ada workshop</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {(adding || !!editing) && (
        <Modal title={editing ? "Edit Workshop" : "Tambah Workshop"} onClose={() => { setAdding(false); setEditing(null); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Nama Workshop" required><input className="input" placeholder="Workshop Animal Pot - Juli 2026" value={form.nama_workshop} onChange={e => setForm(f => ({ ...f, nama_workshop: e.target.value }))} /></Field>
            <Field label="Tanggal" required><input className="input" type="date" value={form.tanggal} onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))} /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Harga Normal"><input className="input" placeholder="Rp 100.000" value={form.harga_normal} onChange={e => setForm(f => ({ ...f, harga_normal: e.target.value }))} /></Field>
              <Field label="Harga Promo"><input className="input" placeholder="Rp 90.000" value={form.harga_promo} onChange={e => setForm(f => ({ ...f, harga_promo: e.target.value }))} /></Field>
            </div>
            <Field label="Fasilitas"><textarea className="input" rows={3} placeholder="Alat rajut, yarn, pola, sertifikat..." value={form.fasilitas} onChange={e => setForm(f => ({ ...f, fasilitas: e.target.value }))} /></Field>
            <Field label="Status Event"><CustomSelect value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={STATUS_OPTS} /></Field>
            <Field label="Status Aktif (Tampil)">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className={`toggle ${form.is_active ? "on" : ""}`} onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))} />
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{form.is_active ? "Aktif (Bisa diakses)" : "Nonaktif (Disembunyikan)"}</span>
              </div>
            </Field>
            <div style={{ display: "flex", gap: 8 }}><button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={saving}><Icons.Save /> {saving ? "Menyimpan..." : "Simpan"}</button><button className="btn btn-secondary" onClick={() => { setAdding(false); setEditing(null); }}>Batal</button></div>
          </div>
        </Modal>
      )}

      {deletingWorkshop && (
        <Modal title="Hapus Workshop" onClose={() => setDeletingWorkshop(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>🗑️</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{deletingWorkshop.nama_workshop}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Tanggal: {fmtDate(deletingWorkshop.tanggal)}</p>
                </div>
              </div>
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 13, color: "#f59e0b", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <span>Anda yakin ingin menghapus workshop ini secara permanen?</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-sm" style={{ flex: 1, justifyContent: "center", background: "linear-gradient(135deg,rgba(239,68,68,0.2),rgba(220,38,38,0.15))", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)", padding: "10px 0", fontWeight: 700 }} onClick={del}>Ya, Hapus</button>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center", padding: "10px 0" }} onClick={() => setDeletingWorkshop(null)}>Batal</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PesananPage({ onCreateInvoiceFromPesanan }: { onCreateInvoiceFromPesanan: (p: Pesanan) => void }) {
  const hasAccess = useAccess();
  const canUpdate = hasAccess("chatbot", "update");
  const canDelete = hasAccess("chatbot", "delete");
  const canCreateInvoice = hasAccess("invoice", "create");
  const { showToast } = useToast();
  const [pesanan, setPesanan] = useState<Pesanan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [marking, setMarking] = useState<number | null>(null);
  const [confirmPesanan, setConfirmPesanan] = useState<Pesanan | null>(null); // pesanan yang mau diselesaikan
  const [deletingPesanan, setDeletingPesanan] = useState<Pesanan | null>(null); // pesanan yang mau dihapus
  const [isDeleting, setIsDeleting] = useState(false);
  const load = useCallback(async () => { setLoading(true); const r = await fetch("/api/pesanan"); setPesanan(await r.json()); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  const filteredPesanan = pesanan.filter(p => p.nama.toLowerCase().includes(search.toLowerCase()) || (p.no_hp || "").includes(search) || (p.produk || "").toLowerCase().includes(search.toLowerCase()));
  const { sortedItems: sortedPesanan, handleSort, sortConfig } = useSort(filteredPesanan);

  const doMarkSelesai = async () => {
    if (!confirmPesanan) return;
    setMarking(confirmPesanan.id);
    setConfirmPesanan(null);
    const res = await fetch(`/api/pesanan/${confirmPesanan.id}/selesai`, { method: "PATCH" });
    setMarking(null);
    if (res.ok) {
      showToast(`✅ Pesanan dari "${confirmPesanan.nama}" telah diselesaikan!`);
      load();
    } else {
      showToast("Gagal menyelesaikan pesanan. Coba lagi.", "err");
    }
  };

  const doDelete = async () => {
    if (!deletingPesanan) return;
    setIsDeleting(true);
    const res = await fetch(`/api/pesanan/${deletingPesanan.id}`, { method: "DELETE" });
    setIsDeleting(false);
    if (res.ok) {
      showToast(`✅ Pesanan dari "${deletingPesanan.nama}" berhasil dihapus!`);
      setDeletingPesanan(null);
      load();
    } else {
      showToast("Gagal menghapus pesanan. Coba lagi.", "err");
    }
  };

  return (
    <div className="animate-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div><h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Pesanan (Pre-order)</h2><p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Dari chatbot Instagram — klik "Buat Invoice" untuk memproses, atau "Selesai" jika sudah ditangani</p></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}><Icons.Search /></span>
            <input className="input" style={{ paddingLeft: 34, width: 220, height: 34, fontSize: 13 }} placeholder="Cari nama, HP, produk..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={load}><Icons.Refresh /></button>
        </div>
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? <div style={{ padding: 20 }}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8 }} />)}</div> : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("id")}># <SortIcon sortConfig={sortConfig} columnKey="id" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("nama")}>Nama <SortIcon sortConfig={sortConfig} columnKey="nama" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("produk")}>Produk <SortIcon sortConfig={sortConfig} columnKey="produk" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("no_hp")}>No HP <SortIcon sortConfig={sortConfig} columnKey="no_hp" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("alamat")}>Alamat <SortIcon sortConfig={sortConfig} columnKey="alamat" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("created_at")}>Waktu <SortIcon sortConfig={sortConfig} columnKey="created_at" /></th>
                  {(canUpdate || canCreateInvoice || canDelete) && <th style={{ width: 220 }}>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {sortedPesanan.map(p => (
                  <tr key={p.id}>
                    <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{p.id}</td>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{p.nama}</td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{p.produk}</td>
                    <td style={{ fontSize: 12, fontFamily: "monospace" }}>{p.no_hp}</td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 160 }}><span style={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{p.alamat}</span></td>
                    <td style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtDate(p.created_at)}</td>
                    {(canUpdate || canCreateInvoice || canDelete) && (
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {canCreateInvoice && <button className="btn btn-primary btn-sm" onClick={() => onCreateInvoiceFromPesanan(p)}><Icons.Receipt /> Buat Invoice</button>}
                          {canUpdate && (
                            <button
                              className="btn btn-sm"
                              style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}
                              onClick={() => setConfirmPesanan(p)}
                              disabled={marking === p.id}
                              title="Tandai sebagai selesai"
                            >
                              {marking === p.id
                                ? <><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #10b981", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Proses...</>
                                : <><Icons.Check /> Selesai</>
                              }
                            </button>
                          )}
                          {canDelete && (
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeletingPesanan(p)} title="Hapus pesanan">
                              <Icons.Trash />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {pesanan.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Tidak ada pesanan aktif</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal Konfirmasi Selesai ── */}
      {confirmPesanan && (
        <Modal title="Tandai Pesanan Selesai" onClose={() => setConfirmPesanan(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Info pesanan */}
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 24 }}>📋</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{confirmPesanan.nama}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{confirmPesanan.produk} • {confirmPesanan.no_hp}</p>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", borderTop: "1px solid rgba(16,185,129,0.2)", paddingTop: 10 }}>
                📍 {confirmPesanan.alamat}
              </p>
            </div>
            {/* Pesan konfirmasi */}
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 13, color: "#f59e0b", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <span>Pesanan ini akan dipindahkan ke <strong>Riwayat Pesanan</strong> dan tidak akan muncul lagi di daftar aktif.</span>
            </div>
            {/* Tombol aksi */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-sm"
                style={{ flex: 1, justifyContent: "center", background: "linear-gradient(135deg,rgba(16,185,129,0.2),rgba(5,150,105,0.15))", color: "#10b981", border: "1px solid rgba(16,185,129,0.4)", padding: "10px 0", fontWeight: 700 }}
                onClick={doMarkSelesai}
              >
                <Icons.Check /> Ya, Tandai Selesai
              </button>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center", padding: "10px 0" }} onClick={() => setConfirmPesanan(null)}>
                Batal
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal Konfirmasi Hapus ── */}
      {deletingPesanan && (
        <Modal title="Hapus Pesanan" onClose={() => setDeletingPesanan(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Info pesanan */}
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 24 }}>🗑️</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{deletingPesanan.nama}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{deletingPesanan.produk} • {deletingPesanan.no_hp}</p>
                </div>
              </div>
            </div>
            {/* Pesan konfirmasi */}
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 13, color: "#f59e0b", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <span>Anda yakin ingin menghapus pesanan ini secara permanen? Data yang dihapus tidak dapat dikembalikan.</span>
            </div>
            {/* Tombol aksi */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-sm"
                style={{ flex: 1, justifyContent: "center", background: "linear-gradient(135deg,rgba(239,68,68,0.2),rgba(220,38,38,0.15))", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)", padding: "10px 0", fontWeight: 700 }}
                onClick={doDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Menghapus..." : "Ya, Hapus"}
              </button>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center", padding: "10px 0" }} onClick={() => setDeletingPesanan(null)}>
                Batal
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Riwayat Pesanan Page ───────────────────────────────────────────────────────
function RiwayatPesananPage() {
  const [riwayat, setRiwayat] = useState<Pesanan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const load = useCallback(async () => { setLoading(true); const r = await fetch("/api/pesanan/riwayat"); setRiwayat(await r.json()); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  const filteredRiwayat = riwayat.filter(p => p.nama.toLowerCase().includes(search.toLowerCase()) || (p.no_hp || "").includes(search) || (p.produk || "").toLowerCase().includes(search.toLowerCase()));
  const { sortedItems: sortedRiwayat, handleSort, sortConfig } = useSort(filteredRiwayat);

  return (
    <div className="animate-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Riwayat Pesanan</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Pesanan yang sudah selesai ditangani</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}><Icons.Search /></span>
            <input className="input" style={{ paddingLeft: 34, width: 220, height: 34, fontSize: 13 }} placeholder="Cari nama, HP, produk..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={load}><Icons.Refresh /></button>
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? <div style={{ padding: 20 }}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8 }} />)}</div> : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("id")}># <SortIcon sortConfig={sortConfig} columnKey="id" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("nama")}>Nama <SortIcon sortConfig={sortConfig} columnKey="nama" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("produk")}>Produk <SortIcon sortConfig={sortConfig} columnKey="produk" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("no_hp")}>No HP <SortIcon sortConfig={sortConfig} columnKey="no_hp" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("alamat")}>Alamat <SortIcon sortConfig={sortConfig} columnKey="alamat" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("created_at")}>Pesanan Masuk <SortIcon sortConfig={sortConfig} columnKey="created_at" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("selesai_at")}>Diselesaikan <SortIcon sortConfig={sortConfig} columnKey="selesai_at" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("diselesaikan_oleh")}>Oleh <SortIcon sortConfig={sortConfig} columnKey="diselesaikan_oleh" /></th>
                </tr>
              </thead>
              <tbody>
                {sortedRiwayat.map(p => (
                  <tr key={p.id}>
                    <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{p.id}</td>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{p.nama}</td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{p.produk}</td>
                    <td style={{ fontSize: 12, fontFamily: "monospace" }}>{p.no_hp}</td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 140 }}>
                      <span style={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{p.alamat}</span>
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtDate(p.created_at)}</td>
                    <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#10b981", fontWeight: 600 }}>
                        <Icons.Check /> {p.selesai_at ? fmtDate(p.selesai_at) : "—"}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.diselesaikan_oleh ?? "—"}</td>
                  </tr>
                ))}
                {riwayat.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                      Belum ada riwayat pesanan. Tandai pesanan aktif sebagai "Selesai" untuk melihatnya di sini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


function ChatLogsPage() {
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ChatLog | null>(null);
  const [search, setSearch] = useState("");
  const load = useCallback(async () => { setLoading(true); const r = await fetch("/api/chat-logs"); setLogs(await r.json()); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  const filtered = logs.filter(l => !search || l.user_message.toLowerCase().includes(search.toLowerCase()) || l.sender_id.includes(search));
  const { sortedItems: sortedLogs, handleSort, sortConfig } = useSort(filtered);
  return (
    <div className="animate-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div><h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Chat Logs</h2><p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{logs.length} percakapan tercatat</p></div>
        <button className="btn btn-secondary btn-sm" onClick={load}><Icons.Refresh /></button>
      </div>
      <div style={{ position: "relative", marginBottom: 16 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}><Icons.Search /></span>
        <input className="input" style={{ paddingLeft: 36 }} placeholder="Cari pesan atau sender ID..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? <div style={{ padding: 20 }}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8 }} />)}</div> : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("sender_id")}>Sender <SortIcon sortConfig={sortConfig} columnKey="sender_id" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("user_message")}>Pesan User <SortIcon sortConfig={sortConfig} columnKey="user_message" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("intent")}>Intent <SortIcon sortConfig={sortConfig} columnKey="intent" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("created_at")}>Waktu <SortIcon sortConfig={sortConfig} columnKey="created_at" /></th>
                  <th style={{ width: 60 }}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {sortedLogs.map(l => (
                  <tr key={l.id}>
                    <td><code style={{ fontSize: 11, color: "#22d3ee" }}>{l.sender_id.slice(0, 16)}...</code></td>
                    <td style={{ maxWidth: 280, fontSize: 13 }}><span style={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{l.user_message}</span></td>
                    <td><span className={`badge ${l.intent === "AI_GEMINI" ? "badge-ai" : l.intent === "FORM_REGISTRATION" ? "badge-form" : "badge-start"}`}>{l.intent}</span></td>
                    <td style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtDate(l.created_at)}</td>
                    <td><button className="btn btn-secondary btn-sm btn-icon" onClick={() => setSelected(l)}><Icons.Eye /></button></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Belum ada log</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selected && (
        <Modal title="Detail Chat Log" onClose={() => setSelected(null)} wide>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--bg-card-2)", border: "1px solid var(--border)", fontSize: 12, color: "var(--text-muted)" }}>Sender: <code style={{ color: "#22d3ee" }}>{selected.sender_id}</code> • {fmtDate(selected.created_at)}</div>
            <div><p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>Pesan User</p><div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)", fontSize: 13, lineHeight: 1.6 }}>{selected.user_message}</div></div>
            <div><p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>Respons Bot</p><div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{selected.bot_response}</div></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

const MODULES = [
  { id: "produk_ws", label: "Produk & WS", desc: "Katalog Produk, Workshops, Stok & Kuota" },
  { id: "invoice", label: "Invoice", desc: "Daftar Invoice, Tipe Invoice, Pesanan" },
  { id: "customer", label: "Customer", desc: "Data Customer, Logbook Pelanggan" },
  { id: "chatbot", label: "Chatbot", desc: "Knowledge Base, Chat Logs, Riwayat Pesanan" },
  { id: "pengaturan", label: "Pengaturan", desc: "Profil Toko, Access Control (Kelola Admin)" }
];
const ACTIONS = [
  { id: "read", label: "Read" },
  { id: "create", label: "Create" },
  { id: "update", label: "Update" },
  { id: "delete", label: "Delete" }
];

function AccessPage() {
  const hasAccess = useAccess();
  const canCreate = hasAccess("pengaturan", "create");
  const canUpdate = hasAccess("pengaturan", "update");
  const canDelete = hasAccess("pengaturan", "delete");
  const { showToast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<{username: string; password: string; role: string; permissions: string[]}>({ username: "", password: "", role: "admin", permissions: [] });
  const [search, setSearch] = useState("");
  const load = useCallback(async () => { setLoading(true); const r = await fetch("/api/admin-users"); if (r.ok) setUsers(await r.json()); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  const filteredUsers = users.filter(u => !search || u.username.toLowerCase().includes(search.toLowerCase()));
  const { sortedItems: sortedUsers, handleSort, sortConfig } = useSort(filteredUsers);

  const saveUser = async () => {
    setSaving(true);
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/admin-users/${editingId}` : "/api/admin-users";
    
    let finalPerms = form.permissions;
    if (form.role === "admin") {
      finalPerms = finalPerms.filter(p => p !== "all");
    }
    
    const payload = { ...form, permissions: finalPerms };
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    showToast(`Admin User berhasil ${editingId ? "diperbarui" : "ditambahkan"}!`);
    setSaving(false); setAdding(false); load();
  };

  const del = async () => { 
    if (!deletingUser) return;
    await fetch(`/api/admin-users/${deletingUser.id}`, { method: "DELETE" }); 
    showToast("Admin User berhasil dihapus!");
    setDeletingUser(null);
    load(); 
  };
  const ROLE_OPTS = [{ value: "admin", label: "👤 Admin" }, { value: "superadmin", label: "⭐ Superadmin" }];
  
  const togglePermission = (perm: string) => {
    setForm(f => {
      const perms = f.permissions || [];
      if (perms.includes(perm)) return { ...f, permissions: perms.filter(p => p !== perm) };
      return { ...f, permissions: [...perms, perm] };
    });
  };

  const openAdd = () => {
    setForm({ username: "", password: "", role: "admin", permissions: [] });
    setEditingId(null);
    setAdding(true);
  };

  const openEdit = (u: any) => {
    let perms: string[] = [];
    if (Array.isArray(u.permissions)) perms = u.permissions;
    else if (typeof u.permissions === "string") {
      try { perms = JSON.parse(u.permissions); } catch { perms = []; }
    }
    if (u.role === "admin") perms = perms.filter(p => p !== "all");
    
    setForm({ username: u.username, password: "", role: u.role, permissions: perms });
    setEditingId(u.id);
    setAdding(true);
  };

  return (
    <div className="animate-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div><h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Access Control</h2><p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Kelola akun admin panel</p></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}><Icons.Search /></span>
            <input className="input" style={{ paddingLeft: 34, width: 220, height: 34, fontSize: 13 }} placeholder="Cari username..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={load}><Icons.Refresh /></button>
          {canCreate && (
            <button className="btn btn-primary btn-sm" onClick={openAdd}><Icons.Plus /> Tambah User</button>
          )}
        </div>
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? <div style={{ padding: 20 }}><div className="skeleton" style={{ height: 52 }} /></div> : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("id")}># <SortIcon sortConfig={sortConfig} columnKey="id" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("username")}>Username <SortIcon sortConfig={sortConfig} columnKey="username" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("role")}>Role <SortIcon sortConfig={sortConfig} columnKey="role" /></th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("created_at")}>Dibuat <SortIcon sortConfig={sortConfig} columnKey="created_at" /></th>
                  <th style={{ width: 100 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map(u => (
                  <tr key={u.id}>
                    <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{u.id}</td>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{u.username}</td>
                    <td><span className={`badge ${u.role === "superadmin" ? "badge-ai" : "badge-form"}`}>{u.role === "superadmin" ? "⭐ Superadmin" : "👤 Admin"}</span></td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{fmtDate(u.created_at)}</td>
                    <td>
                      {u.role !== "superadmin" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          {canUpdate && <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(u)}><span style={{ fontSize: 14 }}>✏️</span></button>}
                          {canDelete && <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeletingUser(u)}><Icons.Trash /></button>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Tidak ada data</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {adding && (
        <Modal title={editingId ? "Edit Admin User" : "Tambah Admin User"} onClose={() => setAdding(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Username" required><input className="input" placeholder="username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} disabled={!!editingId} style={editingId ? { opacity: 0.6 } : {}} /></Field>
            <Field label="Password" required={!editingId}><input className="input" type="password" placeholder={editingId ? "(Kosongkan jika tak ubah sandi)" : "password"} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></Field>
            <Field label="Role"><CustomSelect value={form.role} onChange={v => setForm(f => ({ ...f, role: v }))} options={ROLE_OPTS} /></Field>
            
            {form.role === "admin" && (
              <div style={{ marginTop: 10 }}>
                <label className="field-label" style={{ marginBottom: 12, display: "block" }}>Permissions (Akses Modul)</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--bg-card)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
                  {MODULES.map(m => {
                    const isAllChecked = ACTIONS.every(a => form.permissions.includes(`${m.id}:${a.id}`));
                    return (
                      <div key={m.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "1px dashed var(--border)", paddingBottom: 10, paddingTop: 10 }}>
                        <div style={{ display: "flex", flexDirection: "column", width: 150 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{m.label}</span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.3 }}>{m.desc}</span>
                        </div>
                        <div style={{ display: "flex", gap: 12, alignItems: "center", paddingTop: 4 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: "var(--text-primary)", fontWeight: 600, marginRight: 8 }}>
                            <input type="checkbox" checked={isAllChecked} onChange={e => {
                              const checked = e.target.checked;
                              setForm(f => {
                                let perms = f.permissions || [];
                                const modPerms = ACTIONS.map(a => `${m.id}:${a.id}`);
                                if (checked) perms = [...perms, ...modPerms.filter(p => !perms.includes(p))];
                                else perms = perms.filter(p => !modPerms.includes(p));
                                return { ...f, permissions: perms };
                              });
                            }} style={{ accentColor: "var(--primary)" }} />
                            All
                          </label>
                          {ACTIONS.map(a => {
                            const p = `${m.id}:${a.id}`;
                            const isChecked = form.permissions.includes(p);
                            return (
                              <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: "var(--text-secondary)" }}>
                                <input type="checkbox" checked={isChecked} onChange={() => togglePermission(p)} style={{ accentColor: "var(--primary)" }} />
                                {a.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}><button className="btn btn-primary" style={{ flex: 1 }} onClick={saveUser} disabled={saving}><Icons.Save /> {saving ? "..." : "Simpan"}</button><button className="btn btn-secondary" onClick={() => setAdding(false)}>Batal</button></div>
          </div>
        </Modal>
      )}

      {deletingUser && (
        <Modal title="Hapus Admin User" onClose={() => setDeletingUser(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>🗑️</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{deletingUser.username}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Role: {deletingUser.role}</p>
                </div>
              </div>
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 13, color: "#f59e0b", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <span>Anda yakin ingin menghapus akun admin ini? Tindakan ini tidak dapat dibatalkan.</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-sm" style={{ flex: 1, justifyContent: "center", background: "linear-gradient(135deg,rgba(239,68,68,0.2),rgba(220,38,38,0.15))", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)", padding: "10px 0", fontWeight: 700 }} onClick={del}>Ya, Hapus</button>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center", padding: "10px 0" }} onClick={() => setDeletingUser(null)}>Batal</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Login Page ────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: (data: any) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    if (r.ok) {
      const d = await r.json();
      onLogin(d);
    }
    else { const d = await r.json(); setError(d.error ?? "Login gagal"); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg,rgba(56,189,248,0.15),rgba(6,182,212,0.1))", border: "1px solid rgba(56,189,248,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 8px 30px rgba(14,165,233,0.25)" }}>
            <img src="/Logo_DynoBoo.png" alt="DynoBoo" style={{ height: 54, objectFit: "contain" }} />
          </div>
          <h1 className="gradient-text" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>DynoBoo</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Admin Panel — Semi POS Digital</p>
        </div>
        <div className="card" style={{ padding: 28 }}>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Username"><input className="input" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="superadmin" /></Field>
            <Field label="Password">
              <div style={{ position: "relative" }}>
                <input className="input" type={showPass ? "text" : "password"} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ width: "100%", paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}>
                  {showPass ? <Icons.EyeOff /> : <Icons.Eye />}
                </button>
              </div>
            </Field>
            {error && <p style={{ color: "#f87171", fontSize: 12, background: "rgba(239,68,68,0.08)", padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)" }}>{error}</p>}
            <button className="btn btn-primary" type="submit" style={{ justifyContent: "center", padding: "11px" }} disabled={loading}>{loading ? "Masuk..." : "Masuk"}</button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Notification types ─────────────────────────────────────────────────────────
type Notif = { id: string; type: "pesanan" | "stok" | "invoice" | "info"; title: string; body: string; time: Date; read: boolean; };

const NOTIF_ICONS: Record<Notif["type"], string> = {
  pesanan: "🛒", stok: "📦", invoice: "🧾", info: "ℹ️",
};
const NOTIF_COLORS: Record<Notif["type"], string> = {
  pesanan: "#f59e0b", stok: "#f87171", invoice: "#38bdf8", info: "#a78bfa",
};

type NotifBellProps = {
  notifs: Notif[]; setNotifs: React.Dispatch<React.SetStateAction<Notif[]>>;
  notifOpen: boolean; setNotifOpen: (v: boolean) => void;
  onNavigate: (page: Page) => void;
};

function NotifBell({ notifs, setNotifs, notifOpen, setNotifOpen, onNavigate }: NotifBellProps) {
  const unread = notifs.filter(n => !n.read).length;
  const dismissed = useRef(new Set<string>());

  // Auto-fetch notifications on mount and every 60s
  useEffect(() => {
    const fetchNotifs = async () => {
      const newNotifs: Notif[] = [];
      try {
        // Check new pesanan (chatbot pre-orders)
        const pr = await fetch("/api/pesanan");
        if (pr.ok) {
          const pesanan = await pr.json();
          if (pesanan.length > 0) {
            newNotifs.push({
              id: "pesanan-new",
              type: "pesanan",
              title: `${pesanan.length} Pesanan Pre-order Masuk`,
              body: `Terbaru: ${pesanan[0]?.nama ?? "Customer"} — ${pesanan[0]?.produk ?? ""}`,
              time: new Date(pesanan[0]?.created_at ?? Date.now()),
              read: false,
            });
          }
        }
        // Check low stock
        const sr = await fetch("/api/stocks");
        if (sr.ok) {
          const stocks = await sr.json();
          const low = stocks.filter((s: { qty_available: number; item?: { is_active: boolean } }) =>
            s.qty_available <= 3 && s.item?.is_active);
          if (low.length > 0) {
            newNotifs.push({
              id: "stok-low",
              type: "stok",
              title: `${low.length} Item Stok Kritis (≤ 3)`,
              body: low.slice(0, 3).map((s: { item?: { nama: string }; qty_available: number }) =>
                `${s.item?.nama ?? "Item"}: ${s.qty_available} tersisa`).join(" • "),
              time: new Date(),
              read: false,
            });
          }
        }
        // Check unpaid invoices
        const ir = await fetch("/api/invoices?status=UNPAID");
        if (ir.ok) {
          const inv = await ir.json();
          if (inv.length > 0) {
            newNotifs.push({
              id: "invoice-unpaid",
              type: "invoice",
              title: `${inv.length} Invoice Belum Dibayar`,
              body: `Total tagihan pending perlu tindak lanjut segera.`,
              time: new Date(),
              read: false,
            });
          }
        }
      } catch { /* silent */ }
      if (newNotifs.length > 0) {
        setNotifs(prev => {
          const merged = [...prev];
          for (const n of newNotifs) {
            if (dismissed.current.has(n.id)) continue;
            const idx = merged.findIndex(p => p.id === n.id);
            if (idx >= 0) {
              merged[idx] = { ...n, read: merged[idx].read };
            } else {
              merged.push(n);
            }
          }
          return merged;
        });
      }
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60_000);
    return () => clearInterval(interval);
  }, [setNotifs]);

  const markAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  const markRead = (id: string) => setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const clearAll = () => {
    setNotifs(prev => {
      prev.forEach(n => dismissed.current.add(n.id));
      return [];
    });
  };

  const handleNotifClick = (n: Notif) => {
    markRead(n.id);
    if (n.type === "pesanan") onNavigate("pesanan");
    else if (n.type === "stok") onNavigate("stok");
    else if (n.type === "invoice") onNavigate("invoice-list");
  };

  const timeAgo = (d: Date) => {
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return "Baru saja";
    if (diff < 60) return `${diff} mnt lalu`;
    return `${Math.floor(diff / 60)} jam lalu`;
  };

  return (
    <>
      {/* Bell button */}
      <div style={{ position: "relative" }}>
        <button
          className="theme-btn"
          onClick={() => setNotifOpen(!notifOpen)}
          title="Notifikasi"
          style={{ position: "relative" }}
        >
          {/* Bell icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unread > 0 && (
            <span style={{
              position: "absolute", top: 4, right: 4,
              width: 8, height: 8, borderRadius: "50%",
              background: "#f87171",
              border: "1.5px solid var(--bg-card)",
              animation: "pulse-ring 2s infinite",
            }} />
          )}
        </button>
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -2, right: -2,
            minWidth: 16, height: 16, borderRadius: 8,
            background: "linear-gradient(135deg,#ef4444,#f87171)",
            color: "white", fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 4px", pointerEvents: "none",
            border: "1.5px solid var(--bg-card)",
          }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </div>

      {/* Slide-in notification panel */}
      <div style={{
        position: "fixed", top: 56, right: 0, bottom: 0, zIndex: 500,
        width: notifOpen ? 340 : 0,
        overflow: "hidden",
        transition: "width 0.28s cubic-bezier(0.4,0,0.2,1)",
        pointerEvents: notifOpen ? "auto" : "none",
      }}>
        <div style={{
          width: 340, height: "100%",
          background: "var(--bg-sidebar)",
          borderLeft: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.3)",
        }}>
          {/* Header */}
          <div style={{
            padding: "16px 18px", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "linear-gradient(135deg,rgba(56,189,248,0.08),rgba(6,182,212,0.04))",
            flexShrink: 0,
          }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                🔔 Notifikasi
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {unread > 0 ? `${unread} belum dibaca` : "Semua sudah dibaca"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {unread > 0 && (
                <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={markAllRead}>
                  ✓ Baca Semua
                </button>
              )}
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setNotifOpen(false)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Notifications list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {notifs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
                <p style={{ fontSize: 32, marginBottom: 12 }}>🔕</p>
                <p style={{ fontSize: 13, fontWeight: 600 }}>Tidak ada notifikasi</p>
                <p style={{ fontSize: 12, marginTop: 4, color: "var(--text-subtle)" }}>
                  Notifikasi pesanan, stok, dan invoice akan muncul di sini
                </p>
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  style={{
                    padding: "12px 18px", cursor: "pointer",
                    borderBottom: "1px solid var(--border)",
                    background: n.read ? "transparent" : `${NOTIF_COLORS[n.type]}08`,
                    transition: "background 0.15s",
                    display: "flex", gap: 12, alignItems: "flex-start",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                  onMouseLeave={e => (e.currentTarget.style.background = n.read ? "transparent" : `${NOTIF_COLORS[n.type]}08`)}
                >
                  {/* Icon badge */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: `${NOTIF_COLORS[n.type]}18`,
                    border: `1px solid ${NOTIF_COLORS[n.type]}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16,
                  }}>{NOTIF_ICONS[n.type]}</div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <p style={{
                        fontSize: 13, fontWeight: n.read ? 500 : 700,
                        color: "var(--text-primary)", lineHeight: 1.3,
                      }}>{n.title}</p>
                      {!n.read && (
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: NOTIF_COLORS[n.type], flexShrink: 0, marginTop: 4 }} />
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>{n.body}</p>
                    <p style={{ fontSize: 10, color: "var(--text-subtle)", marginTop: 6 }}>{timeAgo(n.time)}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
              <button className="btn btn-secondary btn-sm" style={{ width: "100%", justifyContent: "center", fontSize: 12 }} onClick={clearAll}>
                🗑 Hapus Semua Notifikasi
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Thin transparent backdrop to close on outside click (non-blocking) */}
      {notifOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 499 }}
          onClick={() => setNotifOpen(false)}
        />
      )}
    </>
  );
}


// ─── Main App ──────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [pageData, setPageData] = useState<unknown>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [currentInvoiceId, setCurrentInvoiceId] = useState<number | null>(null);
  const [prefillPesanan, setPrefillPesanan] = useState<Pesanan | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [userRole, setUserRole] = useState("admin");
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [userName, setUserName] = useState("Admin");

  const [fabPos, setFabPos] = useState({ x: -1, y: -1 });
  const [isDraggingFab, setIsDraggingFab] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0, moved: false });

  useEffect(() => {
    const check = async () => {
      const r = await fetch("/api/auth", { cache: "no-store" });
      if (r.ok) {
        const data = await r.json();
        setIsLoggedIn(true);
        setUserRole(data.role);
        setUserName(data.username || "Admin");
        
        let perms: string[] = [];
        if (Array.isArray(data.permissions)) perms = data.permissions;
        else if (typeof data.permissions === "string") {
          try { perms = JSON.parse(data.permissions); } catch { perms = []; }
        }
        setUserPermissions(perms);
        
        if (data.role !== "superadmin" && !perms.includes("all")) {
          if (perms.some((p: string) => p.startsWith("produk_ws:"))) setCurrentPage("katalog");
          else if (perms.some((p: string) => p.startsWith("invoice:"))) setCurrentPage("invoice-list");
          else if (perms.some((p: string) => p.startsWith("loyalty:"))) setCurrentPage("loyalty");
          else if (perms.some((p: string) => p.startsWith("chatbot:"))) setCurrentPage("ai-assistant");
          else if (perms.some((p: string) => p.startsWith("pengaturan:"))) setCurrentPage("company");
        }
      } else {
        setIsLoggedIn(false);
      }
      setCheckingAuth(false);
    };
    check();
  }, []);

  const hasAccess = (moduleName: string, action = "read") => {
    if (userRole === "superadmin") return true;
    if (userPermissions.includes("all")) return true;
    return userPermissions.includes(`${moduleName}:${action}`);
  };

  useEffect(() => {
    if (darkMode) document.documentElement.classList.remove("light");
    else document.documentElement.classList.add("light");
  }, [darkMode]);

  const logout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setIsLoggedIn(false);
  };

  const handleNavigate = (page: Page, data?: unknown) => {
    setPageData(data);
    if (page === "manual") {
      window.open("/manual", "_blank");
      return;
    }
    if (page === "invoice-form" && data) setPrefillPesanan(data as Pesanan);
    else if (page === "invoice-form") setPrefillPesanan(null);
    setCurrentPage(page);
    setMobileMenuOpen(false);
  };

  const goToInvoiceDetail = (id: number) => { setCurrentInvoiceId(id); setCurrentPage("invoice-detail"); setMobileMenuOpen(false); };
  const goToInvoiceForm = () => { setPrefillPesanan(null); setCurrentPage("invoice-form"); setMobileMenuOpen(false); };
  const createInvoiceFromPesanan = (p: Pesanan) => { setPrefillPesanan(p); setCurrentPage("invoice-form"); setMobileMenuOpen(false); };
  const handleInvoiceCreated = (id: number) => { setCurrentPage("invoice-detail"); setCurrentInvoiceId(id); setMobileMenuOpen(false); };

  const handleFabPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: rect.left,
      initialY: rect.top,
      moved: false,
    };
    setIsDraggingFab(true);
  };

  const handleFabPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDraggingFab) return;
    e.preventDefault(); // Prevent scrolling while dragging on touch
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
    
    setFabPos({ 
      x: Math.max(0, Math.min(window.innerWidth - 56, dragRef.current.initialX + dx)), 
      y: Math.max(0, Math.min(window.innerHeight - 56, dragRef.current.initialY + dy)) 
    });
  };

  const handleFabPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    setIsDraggingFab(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleFabClick = () => {
    if (!dragRef.current.moved) {
      setAiOpen(o => !o);
    }
  };

  if (checkingAuth) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid rgba(56,189,248,0.3)", borderTopColor: "#38bdf8", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Memuat...</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!isLoggedIn) return <LoginPage onLogin={(d) => {
    setIsLoggedIn(true);
    setUserRole(d.role);
    setUserName(d.username || "Admin");
    
    let perms: string[] = [];
    if (Array.isArray(d.permissions)) perms = d.permissions;
    else if (typeof d.permissions === "string") {
      try { perms = JSON.parse(d.permissions); } catch { perms = []; }
    }
    setUserPermissions(perms);
    
    if (d.role !== "superadmin" && !perms.includes("all")) {
      if (perms.some((p: string) => p.startsWith("produk_ws:"))) setCurrentPage("katalog");
      else if (perms.some((p: string) => p.startsWith("invoice:"))) setCurrentPage("invoice-list");
      else if (perms.some((p: string) => p.startsWith("loyalty:"))) setCurrentPage("loyalty");
      else if (perms.some((p: string) => p.startsWith("chatbot:"))) setCurrentPage("ai-assistant");
      else if (perms.some((p: string) => p.startsWith("pengaturan:"))) setCurrentPage("company");
    }
  }} />;

  const PAGE_TITLES: Record<Page, string> = {
    dashboard: "Dashboard", katalog: "Katalog Produk", stok: "Stok & Kuota",
    "invoice-list": "Daftar Invoice", "invoice-form": "Buat Invoice",
    "invoice-detail": "Detail Invoice", "invoice-types": "Tipe Invoice",
    loyalty: "Loyalty Logbook", "laporan-penjualan": "Laporan Penjualan",
    knowledge: "Knowledge Base", workshops: "Workshops",
    pesanan: "Pesanan", "riwayat-pesanan": "Riwayat Pesanan", chatlogs: "Chat Logs",
    company: "Profil Toko", access: "Access Control", "ai-assistant": "AI Assistant",
    manual: "Buku Panduan",
  };

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard": return <DashboardPage onNavigate={handleNavigate} />;
      case "katalog": return <KatalogPage />;
      case "stok": return <StokPage />;
      case "invoice-list": return <InvoiceListPage onViewInvoice={goToInvoiceDetail} onCreateInvoice={goToInvoiceForm} initialSearch={typeof pageData === "string" ? pageData : ""} initialFilters={typeof pageData === "object" ? (pageData as any) : undefined} />;
      case "invoice-form": return <InvoiceFormPage onSuccess={handleInvoiceCreated} onCancel={() => setCurrentPage("invoice-list")} prefillPesanan={prefillPesanan} />;
      case "invoice-detail": return currentInvoiceId ? <InvoiceDetailPage invoiceId={currentInvoiceId} onBack={() => setCurrentPage("invoice-list")} /> : null;
      case "invoice-types": return <InvoiceTypesPage />;
      case "knowledge": return <KnowledgePage />;
      case "workshops": return <WorkshopsPage />;
      case "pesanan": return <PesananPage onCreateInvoiceFromPesanan={createInvoiceFromPesanan} />;
      case "riwayat-pesanan": return <RiwayatPesananPage />;
      case "chatlogs": return <ChatLogsPage />;
      case "loyalty": return <LoyaltyPage onNavigate={handleNavigate} />;
      case "laporan-penjualan": return <MonthlyReportPage onNavigate={handleNavigate} />;
      case "company": return <CompanyPage />;
      case "access": return <AccessPage />;
      case "ai-assistant": return <AiAssistantPage />;
      default: return null;
    }
  };

  return (
    <ToastProvider>
    <div className={`admin-layout ${darkMode ? "" : "light"}`}>
      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 999 }} onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        {/* Logo */}
        <div className="sidebar-logo" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <img src="/Logo_DynoBoo.png" alt="DynoBoo" style={{ height: 26, objectFit: "contain" }} />
            </div>
            <div>
              <p className="gradient-text" style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>DynoBoo</p>
              <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>Admin Panel</p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm btn-icon" style={{ display: "none" }} onClick={() => setMobileMenuOpen(false)}>
            <Icons.X />
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV_GROUPS.filter(group => {
            if (group.key === "MENU" || group.key === "EXTRA") return true;
            if (group.key === "PRODUK & WS") return hasAccess("produk_ws");
            if (group.key === "INVOICE") return hasAccess("invoice");
            if (group.key === "CUSTOMER") return hasAccess("customer");
            if (group.key === "CHATBOT") return hasAccess("chatbot");
            if (group.key === "PENGATURAN") return hasAccess("pengaturan");
            return true;
          }).map((group) => (
            <SidebarGroup
              key={group.key}
              group={group}
              currentPage={currentPage}
              onNavigate={handleNavigate}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <button className="nav-item" style={{ width: "100%", color: "#f87171" }} onClick={logout}>
            <Icons.Logout /><span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content">
        {/* Topbar */}
        <div className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="theme-btn mobile-menu-btn" style={{ display: "none" }} onClick={() => setMobileMenuOpen(m => !m)}>
              <span style={{ fontSize: 16 }}>☰</span>
            </button>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{PAGE_TITLES[currentPage]}</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Theme toggle */}
            <button className="theme-btn" onClick={() => setDarkMode(d => !d)} title="Toggle theme">
              {darkMode ? <Icons.Sun /> : <Icons.Moon />}
            </button>

            {/* Notification Bell */}
            <NotifBell notifs={notifs} setNotifs={setNotifs} notifOpen={notifOpen} setNotifOpen={setNotifOpen} onNavigate={handleNavigate} />

            <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 2px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{userName}</span>
              <div style={{ padding: "4px 10px", borderRadius: 6, background: userRole === "superadmin" ? "rgba(56,189,248,0.12)" : "rgba(167,139,250,0.12)", border: userRole === "superadmin" ? "1px solid rgba(56,189,248,0.25)" : "1px solid rgba(167,139,250,0.25)", fontSize: 11, color: userRole === "superadmin" ? "#38bdf8" : "#a78bfa", fontWeight: 700, textTransform: "uppercase" }}>{userRole}</div>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={logout} title="Logout" style={{ marginLeft: 4, color: "#ef4444", borderColor: "rgba(239,68,68,0.2)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="page-content">
          <AccessContext.Provider value={hasAccess}>
            {renderPage()}
          </AccessContext.Provider>
        </main>
      </div>

      {/* ── Floating AI Chat Bubble ───────────────────────────────────────── */}
      {aiOpen && (
        <div className="ai-chat-panel no-print" style={{
          position: "fixed", zIndex: 9998,
          ...(fabPos.x !== -1
            ? { 
                top: Math.max(20, Math.min(window.innerHeight - 580, fabPos.y - 570)), 
                left: Math.max(20, Math.min(window.innerWidth - 400, fabPos.x - 320)) 
              }
            : { bottom: 88, right: 24 }),
          width: 380, height: 560,
          background: "var(--bg-card)", border: "1px solid var(--border-2)",
          borderRadius: 18, boxShadow: "0 16px 60px rgba(0,0,0,0.55)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          animation: "chatBubbleIn 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          {/* Panel header */}
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid var(--border)",
            background: "linear-gradient(135deg,rgba(2,132,199,0.2),rgba(6,182,212,0.12))",
            display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,#0284c7,#06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🦖</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", lineHeight: 1 }}>AI Assistant DynoBoo</p>
              <p style={{ fontSize: 10, color: "#38bdf8", marginTop: 2 }}>Powered by Gemini ✨</p>
            </div>
            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setAiOpen(false)}><Icons.X /></button>
          </div>
          {/* Chat content */}
          <div style={{ flex: 1, overflow: "hidden", padding: "0 4px 4px" }}>
            <AiAssistantPage />
          </div>
        </div>
      )}

      {/* Bubble button */}
      <button
        className="no-print"
        onPointerDown={handleFabPointerDown}
        onPointerMove={handleFabPointerMove}
        onPointerUp={handleFabPointerUp}
        onClick={handleFabClick}
        style={{
          position: "fixed", zIndex: 9999,
          ...(fabPos.x !== -1 ? { left: fabPos.x, top: fabPos.y } : { bottom: 24, right: 24 }),
          width: 56, height: 56, borderRadius: "50%", border: "none",
          background: aiOpen ? "linear-gradient(135deg,#0284c7,#06b6d4)" : "linear-gradient(135deg,#0ea5e9,#06b6d4)",
          boxShadow: isDraggingFab ? "0 8px 32px rgba(14,165,233,0.7)" : "0 4px 24px rgba(14,165,233,0.55)",
          cursor: isDraggingFab ? "grabbing" : "grab", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26, transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          transform: aiOpen ? "rotate(180deg) scale(1.05)" : "rotate(0deg) scale(1)",
        }}
        title={aiOpen ? "Tutup AI Assistant" : "Buka AI Assistant"}
      >
        {aiOpen ? "✕" : "🦖"}
      </button>

      <style>{`
        @keyframes chatBubbleIn {
          from { opacity: 0; transform: scale(0.85) translateY(20px); transform-origin: bottom right; }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
    </ToastProvider>
  );
}