"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import type { PaymentWithInvoice, FinancialCategory } from "@/lib/supabase";
import { Icons, Modal, Field, useToast, SortIcon, fmtRp, TablePaginationTop, TablePaginationBottom } from "./ui";
import { usePagination } from "@/lib/usePagination";
import { useSort } from "@/lib/useSort";
import { useAccess } from "./AccessContext";

const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];
const MONTH_NAMES = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

const COLOR_PALETTE = [
  "#10b981","#34d399","#06b6d4","#38bdf8","#6366f1","#a78bfa",
  "#f59e0b","#ef4444","#fb7185","#f97316","#6b7280","#14b8a6",
];

function fmtDate(d: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// ── Status badge helpers ─────────────────────────────────────────
function TipeBadge({ tipe }: { tipe: string }) {
  const colors: Record<string, { bg: string; color: string; label: string }> = {
    DP:        { bg: "rgba(245,158,11,0.15)",  color: "#f59e0b", label: "DP" },
    Pelunasan: { bg: "rgba(16,185,129,0.15)",  color: "#10b981", label: "Pelunasan" },
    Full:      { bg: "rgba(56,189,248,0.15)",  color: "#38bdf8", label: "Full" },
  };
  const s = colors[tipe] ?? { bg: "rgba(100,116,139,0.12)", color: "#94a3b8", label: tipe };
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.color}44` }}>
      {s.label}
    </span>
  );
}

function MetodeBadge({ metode }: { metode: string }) {
  const colors: Record<string, string> = { Transfer: "#38bdf8", Cash: "#10b981", QRIS: "#a78bfa", Other: "#94a3b8" };
  const c = colors[metode] ?? "#94a3b8";
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${c}18`, color: c, border: `1px solid ${c}44` }}>
      {metode}
    </span>
  );
}

function StatusBadge({ imported }: { imported: boolean }) {
  return imported ? (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", display: "inline-flex", alignItems: "center", gap: 4 }}>
      ✓ IMPORTED
    </span>
  ) : (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", display: "inline-flex", alignItems: "center", gap: 4 }}>
      ⏳ PENDING
    </span>
  );
}

// ── Import split-screen modal ────────────────────────────────────
function ImportModal({
  payment, categories, onClose, onSaved,
}: {
  payment: PaymentWithInvoice;
  categories: FinancialCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const inv = payment.invoice;

  const defaultDetail = `${payment.tipe} - ${inv?.invoice_no ?? "Invoice"} (${inv?.customer_name ?? ""})`;
  const [form, setForm] = useState({
    tipe: "PEMASUKAN" as "PEMASUKAN" | "PENGELUARAN",
    tanggal: payment.tanggal_bayar?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    nominal: String(payment.jumlah),
    kategori_id: "",
    detail: defaultDetail,
    deskripsi: payment.catatan ?? "",
  });
  const [saving, setSaving] = useState(false);

  const filteredCats = useMemo(() => categories.filter(c => c.tipe === form.tipe), [categories, form.tipe]);

  const save = async () => {
    if (!form.nominal || !form.tanggal) { showToast("Nominal dan tanggal wajib diisi!", "err"); return; }
    setSaving(true);
    const res = await fetch("/api/financial-transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipe: form.tipe,
        kategori_id: form.kategori_id ? Number(form.kategori_id) : null,
        nominal: parseFloat(form.nominal),
        detail: form.detail,
        deskripsi: form.deskripsi,
        tanggal: form.tanggal,
        payment_id: payment.id,
      }),
    });
    if (res.ok) {
      showToast("Berhasil diimport ke Laporan Finansial! ✓");
      onSaved();
    } else {
      const d = await res.json();
      showToast(d.error ?? "Gagal import", "err");
    }
    setSaving(false);
  };

  const invStatusColor = inv?.status_pembayaran === "PAID" ? "#10b981" : inv?.status_pembayaran === "DP" ? "#f59e0b" : "#94a3b8";

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border-2)", borderRadius: 18,
        width: "100%", maxWidth: 900, margin: "auto",
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)", animation: "fadeSlideUp 0.2s ease",
        display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 64px)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>📥</span>
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>Import ke Laporan Finansial</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>Review detail lalu simpan ke laporan</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "var(--bg-card-2)", border: "1px solid var(--border)", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-muted)", fontSize: 16 }}>×</button>
        </div>

        {/* Split body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* ── KIRI: Detail Invoice ── */}
          <div style={{
            width: "45%", borderRight: "1px solid var(--border)", padding: 24,
            overflowY: "auto", background: "var(--bg-card-2)",
          }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>Detail Transaksi Invoice</p>

            {/* Invoice info card */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-2)", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: "#38bdf8" }}>{inv?.invoice_no ?? "—"}</p>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: `${invStatusColor}18`, color: invStatusColor, border: `1px solid ${invStatusColor}44` }}>
                  {inv?.status_pembayaran}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Row label="Customer" value={inv?.customer_name ?? "—"} />
                <Row label="Kontak"   value={inv?.customer_contact ?? "—"} />
                <Row label="Grand Total" value={fmtRp(Number(inv?.grand_total ?? 0))} highlight />
                <Row label="Sisa Tagihan" value={fmtRp(Number(inv?.sisa_tagihan ?? 0))} />
                {inv?.catatan && <Row label="Catatan Invoice" value={inv.catatan} />}
              </div>
            </div>

            {/* Payment info card */}
            <div style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 12, padding: "14px 16px" }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>💳 Pembayaran</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Row label="Tanggal"  value={fmtDate(payment.tanggal_bayar)} />
                <Row label="Jumlah"   value={fmtRp(Number(payment.jumlah))} highlight />
                <Row label="Tipe"     value={payment.tipe} />
                <Row label="Metode"   value={payment.metode} />
                {payment.catatan && <Row label="Catatan" value={payment.catatan} />}
                <Row label="Dicatat oleh" value={payment.dicatat_oleh} />
              </div>
            </div>
          </div>

          {/* ── KANAN: Form ── */}
          <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>Form Laporan Finansial</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Tipe toggle */}
              <Field label="Tipe">
                <div style={{ display: "inline-flex", background: "var(--bg-card-2)", padding: 3, borderRadius: 9, border: "1px solid var(--border)", gap: 3 }}>
                  {(["PEMASUKAN","PENGELUARAN"] as const).map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, tipe: t, kategori_id: "" }))}
                      style={{
                        padding: "7px 18px", borderRadius: 7, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
                        background: form.tipe === t
                          ? t === "PEMASUKAN" ? "rgba(16,185,129,0.22)" : "rgba(239,68,68,0.2)"
                          : "transparent",
                        color: form.tipe === t ? (t === "PEMASUKAN" ? "#10b981" : "#ef4444") : "var(--text-muted)",
                        transition: "all 0.15s",
                      }}>
                      {t === "PEMASUKAN" ? "💰 Pemasukan" : "💸 Pengeluaran"}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Tanggal" required>
                <input className="input" type="date" value={form.tanggal}
                  onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))} />
              </Field>

              <Field label="Nominal (Rp)" required>
                <input className="input" type="number" min="0"
                  value={form.nominal}
                  onChange={e => setForm(f => ({ ...f, nominal: e.target.value }))} />
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  Auto dari pembayaran: <strong style={{ color: "#38bdf8" }}>{fmtRp(Number(payment.jumlah))}</strong>
                </p>
              </Field>

              <Field label="Kategori">
                <select className="input" value={form.kategori_id}
                  onChange={e => setForm(f => ({ ...f, kategori_id: e.target.value }))}>
                  <option value="">— Pilih Kategori —</option>
                  {filteredCats.map(c => <option key={c.id} value={String(c.id)}>{c.nama}</option>)}
                </select>
              </Field>

              <Field label="Detail">
                <input className="input" value={form.detail}
                  onChange={e => setForm(f => ({ ...f, detail: e.target.value }))}
                  placeholder="Detail transaksi..." />
              </Field>

              <Field label="Deskripsi / Note">
                <textarea className="input" rows={3} value={form.deskripsi}
                  onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))}
                  placeholder="Catatan tambahan (opsional)..."
                  style={{ resize: "vertical", fontFamily: "inherit", fontSize: 13 }} />
              </Field>

              <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={saving}>
                  <Icons.Save /> {saving ? "Menyimpan..." : "Import ke Laporan"}
                </button>
                <button className="btn btn-secondary" onClick={onClose}>Batal</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: highlight ? 800 : 600, color: highlight ? "#f8fafc" : "var(--text-secondary)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────
export default function InvoiceTransactionsPage() {
  const hasAccess = useAccess();
  const canDelete = hasAccess("finansial", "delete");
  const { showToast } = useToast();

  const [payments, setPayments]   = useState<PaymentWithInvoice[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [loading, setLoading]     = useState(true);

  // Filters
  const [search,       setSearch]       = useState("");
  const [filterTipe,   setFilterTipe]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTahun,  setFilterTahun]  = useState("");
  const [filterBulan,  setFilterBulan]  = useState("");

  // Import modal
  const [importing, setImporting] = useState<PaymentWithInvoice | null>(null);

  // Delete payment modal
  const [deletingPmt, setDeletingPmt] = useState<PaymentWithInvoice | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [pmtRes, catRes] = await Promise.all([
      fetch("/api/invoice-payments"),
      fetch("/api/financial-categories"),
    ]);
    if (pmtRes.ok) setPayments(await pmtRes.json());
    if (catRes.ok) setCategories(await catRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const years = useMemo(() => {
    const ys = new Set(payments.map(p => p.tanggal_bayar?.slice(0, 4)).filter(Boolean));
    return [...ys].sort().reverse();
  }, [payments]);

  const filtered = useMemo(() => {
    return payments.filter(p => {
      if (search) {
        const q = search.toLowerCase();
        const matchInvoice = p.invoice?.invoice_no?.toLowerCase().includes(q);
        const matchCustomer = p.invoice?.customer_name?.toLowerCase().includes(q);
        if (!matchInvoice && !matchCustomer) return false;
      }
      if (filterTipe   && p.tipe !== filterTipe) return false;
      if (filterStatus === "IMPORTED" && !p.sudah_diimport) return false;
      if (filterStatus === "PENDING"  &&  p.sudah_diimport) return false;
      if (filterTahun  && p.tanggal_bayar?.slice(0, 4) !== filterTahun) return false;
      if (filterBulan  && p.tanggal_bayar?.slice(5, 7) !== filterBulan) return false;
      return true;
    });
  }, [payments, search, filterTipe, filterStatus, filterTahun, filterBulan]);

  const { sortedItems, handleSort, sortConfig } = useSort(filtered);

  const pagination = usePagination(sortedItems);

  // Summary
  const totalPending  = payments.filter(p => !p.sudah_diimport).reduce((s, p) => s + Number(p.jumlah), 0);
  const totalImported = payments.filter(p =>  p.sudah_diimport).reduce((s, p) => s + Number(p.jumlah), 0);
  const countPending  = payments.filter(p => !p.sudah_diimport).length;

  const confirmDelete = async () => {
    if (!deletingPmt) return;
    if (deletingPmt.sudah_diimport) { showToast("Payment yang sudah diimport tidak bisa dihapus langsung", "err"); return; }
    setDeleting(true);
    const res = await fetch(`/api/payments/${deletingPmt.id}`, { method: "DELETE" });
    if (res.ok) { showToast("Payment berhasil dihapus!"); setDeletingPmt(null); load(); }
    else showToast("Gagal menghapus payment", "err");
    setDeleting(false);
  };

  const hasFilter = !!(search || filterTipe || filterStatus || filterTahun || filterBulan);

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800 }} className="gradient-text">Transaksi Invoice</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Riwayat pembayaran invoice — approve untuk masuk ke Laporan Finansial
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}><Icons.Refresh /></button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: "16px 20px", borderLeft: "4px solid #f59e0b", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>⏳</div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Belum Diimport</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: "#f59e0b", marginTop: 3 }}>{fmtRp(totalPending)}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{countPending} transaksi pending</p>
          </div>
        </div>
        <div className="card" style={{ padding: "16px 20px", borderLeft: "4px solid #10b981", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>✓</div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Sudah Diimport</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: "#10b981", marginTop: 3 }}>{fmtRp(totalImported)}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{payments.filter(p => p.sudah_diimport).length} transaksi</p>
          </div>
        </div>
        <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "rgba(56,189,248,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📋</div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Transaksi</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: "#38bdf8", marginTop: 3 }}>{fmtRp(payments.reduce((s, p) => s + Number(p.jumlah), 0))}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{payments.length} pembayaran</p>
          </div>
        </div>
      </div>

      {/* Filters — single row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none", display: "flex" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
          <input
            className="input"
            style={{ paddingLeft: 36, width: "100%", height: 38 }}
            placeholder="Cari no invoice atau nama customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="input" style={{ height: 38, fontSize: 12, width: 140, flexShrink: 0 }}
          value={filterTipe} onChange={e => setFilterTipe(e.target.value)}>
          <option value="">Tipe Bayar</option>
          <option value="DP">DP</option>
          <option value="Pelunasan">Pelunasan</option>
          <option value="Full">Full</option>
        </select>

        <select className="input" style={{ height: 38, fontSize: 12, width: 130, flexShrink: 0 }}
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Semua Status</option>
          <option value="PENDING">⏳ Pending</option>
          <option value="IMPORTED">✓ Imported</option>
        </select>

        <select className="input" style={{ height: 38, fontSize: 12, width: 100, flexShrink: 0 }}
          value={filterTahun} onChange={e => setFilterTahun(e.target.value)}>
          <option value="">Tahun</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select className="input" style={{ height: 38, fontSize: 12, width: 120, flexShrink: 0 }}
          value={filterBulan} onChange={e => setFilterBulan(e.target.value)}>
          <option value="">Bulan</option>
          {MONTHS.map((m, i) => <option key={m} value={m}>{MONTH_NAMES[i]}</option>)}
        </select>

        {hasFilter && (
          <button
            onClick={() => { setSearch(""); setFilterTipe(""); setFilterStatus(""); setFilterTahun(""); setFilterBulan(""); }}
            style={{ height: 38, padding: "0 14px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#ef4444", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            ✕ Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <TablePaginationTop
          totalItems={pagination.totalItems}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          pageSize={pagination.pageSize}
          onPageSizeChange={pagination.handlePageSizeChange}
        />
        {loading ? (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 48 }} />)}
          </div>
        ) : (
          <>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: "center", color: "var(--text-subtle)" }}>#</th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("tanggal_bayar")}>
                    Tanggal <SortIcon sortConfig={sortConfig} columnKey="tanggal_bayar" />
                  </th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("invoice")}>
                    Invoice <SortIcon sortConfig={sortConfig} columnKey="invoice" />
                  </th>
                  <th>Customer</th>
                  <th>Tipe</th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("jumlah")}>
                    Nominal <SortIcon sortConfig={sortConfig} columnKey="jumlah" />
                  </th>
                  <th>Metode</th>
                  <th>Status</th>
                  <th style={{ width: 120 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pagination.paginatedItems.map((p, idx) => (
                  <tr key={p.id}>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-subtle)", background: "var(--bg-card-2)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 7px" }}>
                        {pagination.startIndex + idx}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{fmtDate(p.tanggal_bayar)}</td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8" }}>
                        {p.invoice?.invoice_no ?? `#${p.invoice_id}`}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: "var(--text-primary)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.invoice?.customer_name ?? "—"}
                    </td>
                    <td><TipeBadge tipe={p.tipe} /></td>
                    <td style={{ fontWeight: 800, color: "#10b981", whiteSpace: "nowrap" }}>
                      {fmtRp(Number(p.jumlah))}
                    </td>
                    <td><MetodeBadge metode={p.metode} /></td>
                    <td><StatusBadge imported={p.sudah_diimport} /></td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {!p.sudah_diimport ? (
                          <button
                            onClick={() => setImporting(p)}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                              border: "1px solid rgba(16,185,129,0.35)", cursor: "pointer",
                              background: "linear-gradient(135deg,rgba(16,185,129,0.25),rgba(52,211,153,0.15))",
                              color: "#10b981", transition: "all 0.15s",
                            }}>
                            📥 Import
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-subtle)", fontStyle: "italic", padding: "5px 0" }}>Imported</span>
                        )}
                        {canDelete && !p.sudah_diimport && (
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeletingPmt(p)}>
                            <Icons.Trash />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {pagination.totalItems === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
                      <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
                      <p style={{ fontWeight: 600, marginBottom: 4 }}>Belum ada transaksi pembayaran</p>
                      <p style={{ fontSize: 12 }}>Pembayaran dari invoice akan muncul di sini secara otomatis</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePaginationBottom
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            onPageChange={pagination.handlePageChange}
          />
          </>
        )}
      </div>



      {/* Import modal */}
      {importing && (
        <ImportModal
          payment={importing}
          categories={categories}
          onClose={() => setImporting(null)}
          onSaved={() => { setImporting(null); load(); }}
        />
      )}

      {/* Delete confirm */}
      {deletingPmt && (
        <Modal title="Hapus Payment" onClose={() => setDeletingPmt(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{fmtRp(Number(deletingPmt.jumlah))}</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                {deletingPmt.tipe} • {deletingPmt.invoice?.invoice_no} • {fmtDate(deletingPmt.tanggal_bayar)}
              </p>
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 13, color: "#f59e0b", display: "flex", gap: 8 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <span>Menghapus payment ini akan memperbarui status invoice secara otomatis.</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={deleting}
                style={{ flex: 1, justifyContent: "center", padding: "10px 0", fontWeight: 700, borderRadius: 8, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.15)", color: "#ef4444", cursor: "pointer" }}
                onClick={confirmDelete}>
                {deleting ? "Menghapus..." : "Ya, Hapus"}
              </button>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center", padding: "10px 0" }} onClick={() => setDeletingPmt(null)}>Batal</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
