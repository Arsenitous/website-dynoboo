"use client";
import { useState, useCallback, useEffect } from "react";
import type { Invoice, InvoiceType } from "@/lib/supabase";
import { Icons, CustomSelect, InvoiceStatusBadge, fmtRp, Modal, Field, useToast, SortIcon, TablePaginationTop, TablePaginationBottom } from "./ui";
import { usePagination } from "@/lib/usePagination";
import { useSort } from "@/lib/useSort";
import { useAccess } from "./AccessContext";

type Props = {
  onViewInvoice: (id: number) => void;
  onCreateInvoice: () => void;
  initialSearch?: string;
  initialFilters?: { filterMonth?: string; filterYear?: string };
};

const STATUS_OPTIONS = [
  { value: "", label: "Invoice Aktif (Default)" },
  { value: "UNPAID", label: "○ UNPAID", color: "#f87171" },
  { value: "DP", label: "◑ DP", color: "#fbbf24" },
  { value: "PAID", label: "✓ PAID", color: "#34d399" },
  { value: "CANCELLED", label: "✕ Dibatalkan (CANCELLED)", color: "#94a3b8" },
  { value: "ALL", label: "Semua (Termasuk Dibatalkan)" },
];

const MONTH_OPTIONS = [
  { value: "1", label: "Januari" },
  { value: "2", label: "Februari" },
  { value: "3", label: "Maret" },
  { value: "4", label: "April" },
  { value: "5", label: "Mei" },
  { value: "6", label: "Juni" },
  { value: "7", label: "Juli" },
  { value: "8", label: "Agustus" },
  { value: "9", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

export default function InvoiceListPage({ onViewInvoice, onCreateInvoice, initialSearch, initialFilters }: Props) {
  const hasAccess = useAccess();
  const canCreate = hasAccess("invoice", "create");
  const canUpdate = hasAccess("invoice", "update");
  const canDelete = hasAccess("invoice", "delete");
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [types, setTypes] = useState<InvoiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterMonth, setFilterMonth] = useState(initialFilters?.filterMonth || "");
  const [filterYear, setFilterYear] = useState(initialFilters?.filterYear || "");
  const [search, setSearch] = useState(initialSearch || "");

  // Modal Pembatalan State
  const [targetCancelInvoice, setTargetCancelInvoice] = useState<Invoice | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Modal Filter State
  const [showFilterModal, setShowFilterModal] = useState(false);
  // Draft filter state (applied only on "Terapkan")
  const [draftMonth, setDraftMonth]   = useState(initialFilters?.filterMonth || "");
  const [draftYear, setDraftYear]     = useState(initialFilters?.filterYear  || "");
  const [draftStatus, setDraftStatus] = useState("");
  const [draftType, setDraftType]     = useState("");

  // Modal Laporan State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMode, setReportMode] = useState<"ALL" | "MONTHLY" | "YEARLY">("MONTHLY");
  const [startMonth, setStartMonth] = useState(String(new Date().getMonth() + 1));
  const [endMonth, setEndMonth] = useState(String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

  const currentYr = new Date().getFullYear();
  const YEAR_OPTIONS = [
    { value: String(currentYr + 1), label: String(currentYr + 1) },
    { value: String(currentYr), label: String(currentYr) },
    { value: String(currentYr - 1), label: String(currentYr - 1) },
    { value: String(currentYr - 2), label: String(currentYr - 2) },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const [invRes, typRes] = await Promise.all([
      fetch("/api/invoices"),
      fetch("/api/invoice-types")
    ]);
    if (invRes.ok) setInvoices(await invRes.json());
    if (typRes.ok) setTypes(await typRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Client-side filtering
  const filtered = invoices.filter(inv => {
    const matchesSearch = !search || inv.invoice_no.toLowerCase().includes(search.toLowerCase()) || inv.customer_name.toLowerCase().includes(search.toLowerCase());
    const matchesType = !filterType || String(inv.invoice_type_id) === filterType;

    let matchesStatus = true;
    if (filterStatus === "") {
      // Default: Hanya tampilkan invoice aktif (bukan CANCELLED)
      matchesStatus = inv.status_pembayaran !== "CANCELLED";
    } else if (filterStatus === "ALL") {
      matchesStatus = true;
    } else {
      matchesStatus = inv.status_pembayaran === filterStatus;
    }

    let matchesMonthYear = true;
    if (filterMonth || filterYear) {
      const d = new Date(inv.invoice_date);
      if (filterMonth && (d.getMonth() + 1).toString() !== filterMonth) matchesMonthYear = false;
      if (filterYear && d.getFullYear().toString() !== filterYear) matchesMonthYear = false;
    }

    return matchesSearch && matchesType && matchesStatus && matchesMonthYear;
  });

  const { sortedItems: sortedFiltered, handleSort, sortConfig } = useSort(filtered);

  const pagination = usePagination(sortedFiltered);

  const countActive = invoices.filter(i => i.status_pembayaran !== "CANCELLED").length;
  const totalRevenue = invoices.filter(i => i.status_pembayaran === "PAID").reduce((s, i) => s + Number(i.grand_total), 0);
  const totalUnpaid = invoices.filter(i => ["UNPAID", "DP"].includes(i.status_pembayaran)).reduce((s, i) => s + Number(i.sisa_tagihan), 0);
  const countCancelled = invoices.filter(i => i.status_pembayaran === "CANCELLED").length;

  const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  // Aksi Pembatalan Invoice
  const doCancelInvoice = async () => {
    if (!targetCancelInvoice) return;
    setCancelling(true);
    const res = await fetch(`/api/invoices/${targetCancelInvoice.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status_pembayaran: "CANCELLED" }),
    });
    setCancelling(false);
    if (res.ok) {
      showToast(`🚫 Invoice ${targetCancelInvoice.invoice_no} telah dibatalkan`);
      setTargetCancelInvoice(null);
      load();
    } else {
      showToast("Gagal membatalkan invoice. Coba lagi.", "err");
    }
  };

  // Pulihkan Invoice yang Dibatalkan
  const doRestoreInvoice = async (inv: Invoice) => {
    const res = await fetch(`/api/invoices/${inv.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status_pembayaran: "UNPAID" }),
    });
    if (res.ok) {
      showToast(`✅ Invoice ${inv.invoice_no} dipulihkan ke UNPAID`);
      load();
    } else {
      showToast("Gagal memulihkan invoice.", "err");
    }
  };

  const handleGenerateReport = () => {
    let reportList = invoices.filter(inv => inv.status_pembayaran !== "CANCELLED");
    let filterTitle = "Semua Periode (All)";

    if (reportMode === "MONTHLY") {
      const yr = Number(selectedYear);
      const sM = Number(startMonth);
      const eM = Number(endMonth);
      const minM = Math.min(sM, eM);
      const maxM = Math.max(sM, eM);

      reportList = reportList.filter(inv => {
        const d = new Date(inv.invoice_date);
        const invYr = d.getFullYear();
        const invMo = d.getMonth() + 1;
        return invYr === yr && invMo >= minM && invMo <= maxM;
      });

      const startLabel = MONTH_OPTIONS.find(m => m.value === String(minM))?.label ?? "";
      const endLabel = MONTH_OPTIONS.find(m => m.value === String(maxM))?.label ?? "";
      filterTitle = minM === maxM
        ? `Bulan ${startLabel} ${yr}`
        : `Bulan ${startLabel} s/d ${endLabel} ${yr}`;
    } else if (reportMode === "YEARLY") {
      const yr = Number(selectedYear);
      reportList = reportList.filter(inv => {
        const d = new Date(inv.invoice_date);
        return d.getFullYear() === yr;
      });
      filterTitle = `Tahun ${yr}`;
    }

    const totalInv = reportList.length;
    const grandTotalSum = reportList.reduce((s, i) => s + Number(i.grand_total), 0);
    const paidSum = reportList.filter(i => i.status_pembayaran === "PAID").reduce((s, i) => s + Number(i.grand_total), 0);
    const unpaidSum = reportList.filter(i => ["UNPAID", "DP"].includes(i.status_pembayaran)).reduce((s, i) => s + Number(i.sisa_tagihan), 0);

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const rowsHtml = reportList.map(inv => `
      <tr>
        <td style="font-family:monospace;font-weight:bold;color:#7c3aed">${inv.invoice_no}</td>
        <td>${fmt(inv.invoice_date)}</td>
        <td><strong>${inv.customer_name}</strong>${inv.customer_contact ? `<br><small style="color:#64748b">${inv.customer_contact}</small>` : ""}</td>
        <td>${inv.invoice_type?.nama ?? "—"}</td>
        <td style="text-align:right;font-weight:600">${fmtRp(inv.grand_total)}</td>
        <td style="text-align:right">${fmtRp(inv.dp_amount ?? 0)}</td>
        <td style="text-align:right;color:${inv.sisa_tagihan > 0 ? '#d97706' : '#10b981'};font-weight:600">${fmtRp(inv.sisa_tagihan ?? 0)}</td>
        <td style="text-align:center"><span style="padding:4px 8px;border-radius:4px;font-size:11px;font-weight:bold;background:${inv.status_pembayaran === "PAID" ? "#d1fae5" : inv.status_pembayaran === "DP" ? "#fef3c7" : inv.status_pembayaran === "CANCELLED" ? "#f1f5f9" : "#fee2e2"};color:${inv.status_pembayaran === "PAID" ? "#065f46" : inv.status_pembayaran === "DP" ? "#92400e" : inv.status_pembayaran === "CANCELLED" ? "#475569" : "#991b1b"}">${inv.status_pembayaran}</span></td>
      </tr>
    `).join("");

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Laporan Penjualan DynoBoo - ${filterTitle}</title>
  <style>
    @page { size: A4 landscape; margin: 1cm; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 24px; color: #0f172a; background: white; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #7c3aed; padding-bottom: 16px; margin-bottom: 20px; }
    .title-box h1 { margin: 0; font-size: 24px; color: #7c3aed; font-weight: 800; }
    .title-box p { margin: 4px 0 0; color: #64748b; font-size: 13px; }
    .meta-box { text-align: right; font-size: 12px; color: #64748b; }
    
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
    .stat-card .val { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 2px; }
    .stat-card .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; }
    
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
    th { background: #f1f5f9; color: #475569; padding: 10px 12px; text-align: left; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; border-bottom: 2px solid #cbd5e1; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    tr:nth-child(even) td { background: #fafafa; }
    
    .footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-box">
      <h1>DynoBoo — Laporan Penjualan</h1>
      <p>Periode: <strong>${filterTitle}</strong></p>
    </div>
    <div class="meta-box">
      <p>Tanggal Cetak: <strong>${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</strong></p>
      <p>Dicetak Oleh: <strong>superadmin</strong></p>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card"><div class="lbl">Total Invoice</div><div class="val" style="color:#7c3aed">${totalInv}</div></div>
    <div class="stat-card"><div class="lbl">Total Omset (Grand Total)</div><div class="val" style="color:#2563eb">${fmtRp(grandTotalSum)}</div></div>
    <div class="stat-card"><div class="lbl">Revenue (PAID)</div><div class="val" style="color:#16a34a">${fmtRp(paidSum)}</div></div>
    <div class="stat-card"><div class="lbl">Belum Lunas / Sisa</div><div class="val" style="color:#d97706">${fmtRp(unpaidSum)}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>No Invoice</th>
        <th>Tanggal</th>
        <th>Customer</th>
        <th>Tipe</th>
        <th style="text-align:right">Grand Total</th>
        <th style="text-align:right">DP / Dibayar</th>
        <th style="text-align:right">Sisa Tagihan</th>
        <th style="text-align:center">Status</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml.length > 0 ? rowsHtml : `<tr><td colSpan="8" style="text-align:center;padding:32px;color:#94a3b8">Tidak ada data invoice untuk periode ini.</td></tr>`}
    </tbody>
  </table>

  <div class="footer">
    <div>DynoBoo Admin Panel — Laporan Resmi Penjualan</div>
    <div>Halaman 1 dari 1</div>
  </div>

  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`);
    printWindow.document.close();
    setShowReportModal(false);
  };

  const typeOptions = [{ value: "", label: "Semua Tipe" }, ...types.map(t => ({ value: String(t.id), label: t.nama }))];

  return (
    <div className="animate-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Daftar Invoice</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>History penjualan DynoBoo</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowReportModal(true)}><Icons.Printer /> Laporan PDF</button>
          <button className="btn btn-secondary btn-sm" onClick={load}><Icons.Refresh /> Refresh</button>
          {canCreate && (
            <button className="btn btn-primary btn-sm" onClick={onCreateInvoice}><Icons.Plus /> Buat Invoice</button>
          )}
        </div>
      </div>

      {/* Summary bar - Clickable Cards for Filtering */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Invoice", value: String(countActive), color: "#a78bfa", bg: "rgba(124,58,237,0.12)", filterKey: "", active: filterStatus === "" },
          { label: "Revenue (PAID)", value: fmtRp(totalRevenue), color: "#34d399", bg: "rgba(52,211,153,0.12)", filterKey: "PAID", active: filterStatus === "PAID" },
          { label: "Belum Lunas", value: fmtRp(totalUnpaid), color: "#fbbf24", bg: "rgba(245,158,11,0.12)", filterKey: "UNPAID", active: filterStatus === "UNPAID" },
          { label: "Dibatalkan", value: String(countCancelled), color: "#f87171", bg: "rgba(239,68,68,0.12)", filterKey: "CANCELLED", active: filterStatus === "CANCELLED" },
        ].map(s => (
          <div
            key={s.label}
            className="card"
            style={{
              padding: "14px 16px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              border: s.active ? `1.5px solid ${s.color}` : "1px solid var(--border)",
              boxShadow: s.active ? `0 0 16px ${s.color}30` : "none",
              background: s.active ? `${s.color}10` : "var(--bg-card)",
            }}
            onClick={() => setFilterStatus(s.filterKey)}
            title={`Klik untuk memfilter: ${s.label}`}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</p>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${s.color}20`, color: s.color }}>
                {s.active ? "Aktif" : "Lihat →"}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Search Bar + Filter Button ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{
            position: "absolute", left: 11, top: 0, bottom: 0,
            display: "flex", alignItems: "center", pointerEvents: "none",
            color: "var(--text-muted)",
          }}><Icons.Search /></span>
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Cari no invoice atau nama customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {/* Filter button */}
        {(() => {
          const activeCount = [filterMonth, filterYear, filterType, filterStatus && filterStatus !== "" ? filterStatus : ""].filter(Boolean).length;
          return (
            <button
              onClick={() => {
                setDraftMonth(filterMonth);
                setDraftYear(filterYear);
                setDraftStatus(filterStatus);
                setDraftType(filterType);
                setShowFilterModal(true);
              }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 38, padding: "0 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: "pointer", flexShrink: 0, transition: "all 0.2s",
                border: activeCount > 0 ? "1.5px solid #38bdf8" : "1px solid var(--border-2)",
                background: activeCount > 0 ? "rgba(56,189,248,0.12)" : "var(--bg-card-2)",
                color: activeCount > 0 ? "#38bdf8" : "var(--text-primary)",
                boxShadow: activeCount > 0 ? "0 0 12px rgba(56,189,248,0.2)" : "none",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              Filter
              {activeCount > 0 && (
                <span style={{
                  background: "#38bdf8", color: "#0c1a2e",
                  borderRadius: 20, fontSize: 10, fontWeight: 800,
                  padding: "1px 6px", marginLeft: 2,
                }}>{activeCount}</span>
              )}
            </button>
          );
        })()}
      </div>

      {/* ── Active Filter Chips ── */}
      {(filterMonth || filterYear || filterStatus || filterType) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginRight: 2 }}>Filter aktif:</span>
          {filterMonth && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 10px 3px 8px", borderRadius: 20, background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)", color: "#38bdf8" }}>
              🗓 {MONTH_OPTIONS.find(m => m.value === filterMonth)?.label}
              <button onClick={() => setFilterMonth("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#38bdf8", fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
            </span>
          )}
          {filterYear && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 10px 3px 8px", borderRadius: 20, background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)", color: "#38bdf8" }}>
              📅 {filterYear}
              <button onClick={() => setFilterYear("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#38bdf8", fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
            </span>
          )}
          {filterStatus && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 10px 3px 8px", borderRadius: 20, background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)", color: "#38bdf8" }}>
              🔖 {STATUS_OPTIONS.find(s => s.value === filterStatus)?.label}
              <button onClick={() => setFilterStatus("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#38bdf8", fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
            </span>
          )}
          {filterType && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 10px 3px 8px", borderRadius: 20, background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)", color: "#38bdf8" }}>
              📋 {typeOptions.find(t => t.value === filterType)?.label}
              <button onClick={() => setFilterType("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#38bdf8", fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
            </span>
          )}
          <button
            onClick={() => { setFilterMonth(""); setFilterYear(""); setFilterStatus(""); setFilterType(""); }}
            style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 20, padding: "3px 10px", cursor: "pointer" }}
          >✕ Reset Semua</button>
        </div>
      )}

      <div className="card" style={{ overflow: "hidden" }}>
        <TablePaginationTop
          totalItems={pagination.totalItems}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          pageSize={pagination.pageSize}
          onPageSizeChange={pagination.handlePageSizeChange}
        />
        {loading ? (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52 }} />)}</div>
        ) : (
          <table className="data-table">
            <thead><tr>
              <th style={{ width: 44, textAlign: "center", color: "var(--text-subtle)" }}>#</th>
              <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("invoice_no")}>No Invoice <SortIcon sortConfig={sortConfig} columnKey="invoice_no" /></th>
              <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("invoice_date")}>Tanggal <SortIcon sortConfig={sortConfig} columnKey="invoice_date" /></th>
              <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("customer_name")}>Customer <SortIcon sortConfig={sortConfig} columnKey="customer_name" /></th>
              <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("invoice_type.nama")}>Tipe <SortIcon sortConfig={sortConfig} columnKey="invoice_type.nama" /></th>
              <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("grand_total")}>Grand Total <SortIcon sortConfig={sortConfig} columnKey="grand_total" /></th>
              <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("status_pembayaran")}>Status <SortIcon sortConfig={sortConfig} columnKey="status_pembayaran" /></th>
              <th style={{ width: 120 }}>Aksi</th>
            </tr></thead>
            <tbody>
              {pagination.paginatedItems.map((inv, idx) => (
                <tr key={inv.id} style={{ cursor: "pointer" }} onClick={() => onViewInvoice(inv.id)}>
                  <td style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-subtle)", background: "var(--bg-card-2)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 7px" }}>
                      {pagination.startIndex + idx}
                    </span>
                  </td>
                  <td><span style={{ fontFamily: "monospace", fontSize: 12, color: "#a78bfa", fontWeight: 600 }}>{inv.invoice_no}</span></td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmt(inv.invoice_date)}</td>
                  <td>
                    <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>{inv.customer_name}</p>
                    {inv.customer_contact && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{inv.customer_contact}</p>}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{inv.invoice_type?.nama ?? "—"}</td>
                  <td style={{ fontWeight: 700, color: "var(--text-primary)" }}>{fmtRp(inv.grand_total)}</td>
                  <td><InvoiceStatusBadge status={inv.status_pembayaran} /></td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-secondary btn-sm btn-icon" title="Lihat Detail" onClick={() => onViewInvoice(inv.id)}>
                        <Icons.Eye />
                      </button>
                      {inv.status_pembayaran !== "CANCELLED" ? (
                        canDelete && (
                          <button
                            className="btn btn-sm btn-icon"
                            style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
                            title="Batalkan Invoice"
                            onClick={() => setTargetCancelInvoice(inv)}
                          >
                            <Icons.X />
                          </button>
                        )
                      ) : (
                        canUpdate && (
                          <button
                            className="btn btn-sm btn-icon"
                            style={{ background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }}
                            title="Pulihkan Invoice"
                            onClick={() => doRestoreInvoice(inv)}
                          >
                            <Icons.Refresh />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
                    {filterStatus === "CANCELLED" ? "🚫 Tidak ada invoice yang dibatalkan" : "🧾 Belum ada invoice"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        <TablePaginationBottom
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          onPageChange={pagination.handlePageChange}
        />
      </div>

      {/* ── Modal Konfirmasi Pembatalan Invoice ── */}
      {targetCancelInvoice && (
        <Modal title="Konfirmasi Pembatalan Invoice" onClose={() => setTargetCancelInvoice(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 26 }}>🚫</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>{targetCancelInvoice.invoice_no}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Customer: <strong>{targetCancelInvoice.customer_name}</strong> • Total: <strong style={{ color: "#a78bfa" }}>{fmtRp(targetCancelInvoice.grand_total)}</strong></p>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", borderTop: "1px solid rgba(239,68,68,0.2)", paddingTop: 10 }}>
                Status saat ini: <strong style={{ color: "#fbbf24" }}>{targetCancelInvoice.status_pembayaran}</strong>
              </p>
            </div>

            <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 13, color: "#f59e0b", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <span>Invoice yang dibatalkan akan diubah statusnya menjadi <strong>CANCELLED</strong> dan disembunyikan dari daftar invoice aktif. Anda tetap dapat melihatnya melalui kartu <strong>"Dibatalkan"</strong>.</span>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button
                className="btn btn-sm"
                style={{ flex: 1, justifyContent: "center", background: "linear-gradient(135deg,rgba(239,68,68,0.25),rgba(220,38,38,0.2))", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)", padding: "10px 0", fontWeight: 700 }}
                onClick={doCancelInvoice}
                disabled={cancelling}
              >
                {cancelling ? "Proses..." : "Ya, Batalkan Invoice"}
              </button>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center", padding: "10px 0" }} onClick={() => setTargetCancelInvoice(null)}>
                Batal
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal Filter Laporan PDF ── */}
      {showReportModal && (
        <Modal title="Cetak Laporan Penjualan PDF" onClose={() => setShowReportModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Field label="Pilih Mode Filter Periode">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                <button
                  className="btn btn-sm"
                  style={{
                    justifyContent: "center",
                    background: reportMode === "MONTHLY" ? "rgba(56,189,248,0.18)" : "var(--bg-card-2)",
                    border: `1px solid ${reportMode === "MONTHLY" ? "#38bdf8" : "var(--border)"}`,
                    color: reportMode === "MONTHLY" ? "#38bdf8" : "var(--text-secondary)",
                    fontWeight: reportMode === "MONTHLY" ? 700 : 500,
                  }}
                  onClick={() => setReportMode("MONTHLY")}
                >
                  Per Bulan
                </button>

                <button
                  className="btn btn-sm"
                  style={{
                    justifyContent: "center",
                    background: reportMode === "YEARLY" ? "rgba(56,189,248,0.18)" : "var(--bg-card-2)",
                    border: `1px solid ${reportMode === "YEARLY" ? "#38bdf8" : "var(--border)"}`,
                    color: reportMode === "YEARLY" ? "#38bdf8" : "var(--text-secondary)",
                    fontWeight: reportMode === "YEARLY" ? 700 : 500,
                  }}
                  onClick={() => setReportMode("YEARLY")}
                >
                  Per Tahun
                </button>

                <button
                  className="btn btn-sm"
                  style={{
                    justifyContent: "center",
                    background: reportMode === "ALL" ? "rgba(56,189,248,0.18)" : "var(--bg-card-2)",
                    border: `1px solid ${reportMode === "ALL" ? "#38bdf8" : "var(--border)"}`,
                    color: reportMode === "ALL" ? "#38bdf8" : "var(--text-secondary)",
                    fontWeight: reportMode === "ALL" ? 700 : 500,
                  }}
                  onClick={() => setReportMode("ALL")}
                >
                  Semua (All)
                </button>
              </div>
            </Field>

            {/* Sub-Form berdasarkan Mode */}
            {reportMode === "MONTHLY" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, background: "var(--bg-card-2)", padding: 14, borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Bulan Awal">
                    <CustomSelect value={startMonth} onChange={setStartMonth} options={MONTH_OPTIONS} />
                  </Field>
                  <Field label="Bulan Akhir">
                    <CustomSelect value={endMonth} onChange={setEndMonth} options={MONTH_OPTIONS} />
                  </Field>
                </div>
                <Field label="Tahun">
                  <CustomSelect value={selectedYear} onChange={setSelectedYear} options={YEAR_OPTIONS} />
                </Field>
              </div>
            )}

            {reportMode === "YEARLY" && (
              <div style={{ background: "var(--bg-card-2)", padding: 14, borderRadius: 10, border: "1px solid var(--border)" }}>
                <Field label="Pilih Tahun Laporan">
                  <CustomSelect value={selectedYear} onChange={setSelectedYear} options={YEAR_OPTIONS} />
                </Field>
              </div>
            )}

            {reportMode === "ALL" && (
              <div style={{ background: "rgba(56,189,248,0.08)", padding: 14, borderRadius: 10, border: "1px solid rgba(56,189,248,0.2)", fontSize: 13, color: "var(--text-secondary)", display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 20 }}>📊</span>
                <span>Mencetak seluruh histori laporan transaksi tanpa batasan tanggal.</span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: "center", padding: "11px 0" }}
                onClick={handleGenerateReport}
              >
                <Icons.Printer /> Cetak Laporan PDF
              </button>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: "center", padding: "11px 0" }}
                onClick={() => setShowReportModal(false)}
              >
                Batal
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Filter Modal ── */}
      {showFilterModal && (
        <Modal title="Filter Invoice" onClose={() => setShowFilterModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Status */}
            <Field label="Status Pembayaran">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDraftStatus(opt.value)}
                    style={{
                      padding: "9px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                      border: draftStatus === opt.value ? "1.5px solid #38bdf8" : "1px solid var(--border-2)",
                      background: draftStatus === opt.value ? "rgba(56,189,248,0.12)" : "var(--bg-card-2)",
                      color: draftStatus === opt.value ? "#38bdf8" : "var(--text-secondary)",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>

            {/* Periode */}
            <Field label="Periode">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>BULAN</p>
                  <CustomSelect
                    value={draftMonth}
                    onChange={setDraftMonth}
                    options={[{ value: "", label: "Semua Bulan" }, ...MONTH_OPTIONS]}
                  />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>TAHUN</p>
                  <CustomSelect
                    value={draftYear}
                    onChange={setDraftYear}
                    options={[{ value: "", label: "Semua Tahun" }, ...YEAR_OPTIONS]}
                  />
                </div>
              </div>
            </Field>

            {/* Tipe Invoice */}
            <Field label="Tipe Invoice">
              <CustomSelect
                value={draftType}
                onChange={setDraftType}
                options={typeOptions}
              />
            </Field>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: "center", padding: "11px 0", fontWeight: 700 }}
                onClick={() => {
                  setFilterMonth(draftMonth);
                  setFilterYear(draftYear);
                  setFilterStatus(draftStatus);
                  setFilterType(draftType);
                  setShowFilterModal(false);
                }}
              >
                ✓ Terapkan Filter
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: "11px 16px", fontWeight: 600 }}
                onClick={() => {
                  setDraftMonth(""); setDraftYear(""); setDraftStatus(""); setDraftType("");
                  setFilterMonth(""); setFilterYear(""); setFilterStatus(""); setFilterType("");
                  setShowFilterModal(false);
                }}
              >
                Reset
              </button>
            </div>

          </div>
        </Modal>
      )}

    </div>
  );
}

