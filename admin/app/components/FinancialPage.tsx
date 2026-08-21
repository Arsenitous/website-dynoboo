"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import type { FinancialCategory, FinancialTransaction } from "@/lib/supabase";
import { Icons, Modal, Field, useToast, SortIcon, fmtRp } from "./ui";
import { useSort } from "@/lib/useSort";
import { useAccess } from "./AccessContext";

// ─── Preset colour palette ────────────────────────────────────────────────────
const COLOR_PALETTE = [
  "#10b981","#34d399","#06b6d4","#38bdf8","#6366f1","#a78bfa",
  "#f59e0b","#ef4444","#fb7185","#f97316","#6b7280","#14b8a6",
];

type TxForm = {
  tipe: "PEMASUKAN" | "PENGELUARAN";
  kategori_id: string;
  nominal: string;
  detail: string;
  deskripsi: string;
  tanggal: string;
};

type CatForm = {
  nama: string;
  tipe: "PEMASUKAN" | "PENGELUARAN";
  warna: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d: string) {
  if (!d) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const emptyTxForm = (tipe: "PEMASUKAN" | "PENGELUARAN"): TxForm => ({
  tipe,
  kategori_id: "",
  nominal: "",
  detail: "",
  deskripsi: "",
  tanggal: today(),
});

// ─── Saldo Summary Card ───────────────────────────────────────────────────────
function SaldoCard({ transactions }: { transactions: FinancialTransaction[] }) {
  const totalPemasukan = transactions
    .filter(t => t.tipe === "PEMASUKAN")
    .reduce((s, t) => s + Number(t.nominal), 0);
  const totalPengeluaran = transactions
    .filter(t => t.tipe === "PENGELUARAN")
    .reduce((s, t) => s + Number(t.nominal), 0);
  const saldo = totalPemasukan - totalPengeluaran;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
      <div className="card" style={{ padding: "18px 20px", borderLeft: "4px solid #10b981", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>💰</div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Pemasukan</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#10b981", marginTop: 3 }}>{fmtRp(totalPemasukan)}</p>
        </div>
      </div>
      <div className="card" style={{ padding: "18px 20px", borderLeft: "4px solid #ef4444", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>💸</div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Pengeluaran</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#ef4444", marginTop: 3 }}>{fmtRp(totalPengeluaran)}</p>
        </div>
      </div>
      <div className="card" style={{
        padding: "18px 20px",
        borderLeft: `4px solid ${saldo >= 0 ? "#38bdf8" : "#f59e0b"}`,
        display: "flex", alignItems: "center", gap: 14,
        background: saldo >= 0
          ? "linear-gradient(135deg,rgba(56,189,248,0.06),transparent)"
          : "linear-gradient(135deg,rgba(245,158,11,0.06),transparent)",
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: saldo >= 0 ? "rgba(56,189,248,0.15)" : "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
          {saldo >= 0 ? "📈" : "📉"}
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Saldo Bersih</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: saldo >= 0 ? "#38bdf8" : "#f59e0b", marginTop: 3 }}>{fmtRp(Math.abs(saldo))}</p>
          <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{saldo >= 0 ? "Surplus" : "Defisit"}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FinancialPage() {
  const hasAccess = useAccess();
  const canCreate  = hasAccess("finansial", "create");
  const canUpdate  = hasAccess("finansial", "update");
  const canDelete  = hasAccess("finansial", "delete");
  const { showToast } = useToast();

  // ── State ──
  const [activeTab, setActiveTab] = useState<"PEMASUKAN" | "PENGELUARAN">("PEMASUKAN");
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterKat, setFilterKat] = useState("");
  const [filterTahun, setFilterTahun] = useState("");
  const [filterBulan, setFilterBulan] = useState("");

  // Modals
  const [showTxModal, setShowTxModal] = useState(false);
  const [editingTx, setEditingTx] = useState<FinancialTransaction | null>(null);
  const [txForm, setTxForm] = useState<TxForm>(emptyTxForm("PEMASUKAN"));
  const [savingTx, setSavingTx] = useState(false);
  const [deletingTx, setDeletingTx] = useState<FinancialTransaction | null>(null);
  const [deletingTxId, setDeletingTxId] = useState(false);

  // Category management modal
  const [showCatModal, setShowCatModal] = useState(false);
  const [catForm, setCatForm] = useState<CatForm>({ nama: "", tipe: "PEMASUKAN", warna: "#38bdf8" });
  const [editingCat, setEditingCat] = useState<FinancialCategory | null>(null);
  const [savingCat, setSavingCat] = useState(false);
  const [deletingCat, setDeletingCat] = useState<FinancialCategory | null>(null);
  const [deletingCatId, setDeletingCatId] = useState(false);

  // ── Data Fetching ──
  const load = useCallback(async () => {
    setLoading(true);
    const [txRes, catRes] = await Promise.all([
      fetch("/api/financial-transactions"),
      fetch("/api/financial-categories"),
    ]);
    if (txRes.ok) setTransactions(await txRes.json());
    if (catRes.ok) setCategories(await catRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived lists ──
  const tabCategories = useMemo(
    () => categories.filter(c => c.tipe === activeTab),
    [categories, activeTab]
  );

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (t.tipe !== activeTab) return false;
      if (filterKat && String(t.kategori_id) !== filterKat) return false;
      if (filterTahun) {
        const y = t.tanggal?.slice(0, 4);
        if (y !== filterTahun) return false;
      }
      if (filterBulan) {
        const m = t.tanggal?.slice(5, 7);
        if (m !== filterBulan) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const katNama = t.kategori?.nama?.toLowerCase() ?? "";
        const det = (t.detail ?? "").toLowerCase();
        const des = (t.deskripsi ?? "").toLowerCase();
        if (!katNama.includes(q) && !det.includes(q) && !des.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, activeTab, filterKat, filterTahun, filterBulan, search]);

  const { sortedItems, handleSort, sortConfig } = useSort(filtered);

  // Unique years for filter
  const years = useMemo(() => {
    const ys = new Set(transactions.map(t => t.tanggal?.slice(0, 4)).filter(Boolean));
    return [...ys].sort().reverse();
  }, [transactions]);

  // ── TX CRUD ──
  const openAddTx = () => {
    setTxForm(emptyTxForm(activeTab));
    setEditingTx(null);
    setShowTxModal(true);
  };

  const openEditTx = (tx: FinancialTransaction) => {
    setTxForm({
      tipe: tx.tipe,
      kategori_id: tx.kategori_id ? String(tx.kategori_id) : "",
      nominal: String(tx.nominal),
      detail: tx.detail ?? "",
      deskripsi: tx.deskripsi ?? "",
      tanggal: tx.tanggal,
    });
    setEditingTx(tx);
    setShowTxModal(true);
  };

  const saveTx = async () => {
    if (!txForm.nominal || !txForm.tanggal) {
      showToast("Nominal dan tanggal wajib diisi!", "err");
      return;
    }
    setSavingTx(true);
    const payload = {
      tipe: txForm.tipe,
      kategori_id: txForm.kategori_id ? Number(txForm.kategori_id) : null,
      nominal: parseFloat(txForm.nominal.replace(/[^0-9.]/g, "")),
      detail: txForm.detail,
      deskripsi: txForm.deskripsi,
      tanggal: txForm.tanggal,
    };
    const url = editingTx ? `/api/financial-transactions/${editingTx.id}` : "/api/financial-transactions";
    const method = editingTx ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      showToast(`Transaksi berhasil ${editingTx ? "diperbarui" : "ditambahkan"}!`);
      setShowTxModal(false);
      setEditingTx(null);
      load();
    } else {
      const d = await res.json();
      showToast(d.error ?? "Gagal menyimpan transaksi", "err");
    }
    setSavingTx(false);
  };

  const confirmDeleteTx = async () => {
    if (!deletingTx) return;
    setDeletingTxId(true);
    const res = await fetch(`/api/financial-transactions/${deletingTx.id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Transaksi berhasil dihapus!");
      setDeletingTx(null);
      load();
    } else {
      showToast("Gagal menghapus transaksi", "err");
    }
    setDeletingTxId(false);
  };

  // ── Category CRUD ──
  const openAddCat = () => {
    setCatForm({ nama: "", tipe: activeTab, warna: "#38bdf8" });
    setEditingCat(null);
    setShowCatModal(true);
  };

  const openEditCat = (c: FinancialCategory) => {
    setCatForm({ nama: c.nama, tipe: c.tipe, warna: c.warna });
    setEditingCat(c);
  };

  const saveCat = async () => {
    if (!catForm.nama.trim()) { showToast("Nama kategori wajib diisi!", "err"); return; }
    setSavingCat(true);
    const url = editingCat ? `/api/financial-categories/${editingCat.id}` : "/api/financial-categories";
    const method = editingCat ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(catForm) });
    if (res.ok) {
      showToast(`Kategori berhasil ${editingCat ? "diperbarui" : "ditambahkan"}!`);
      setEditingCat(null);
      setCatForm({ nama: "", tipe: activeTab, warna: "#38bdf8" });
      load();
    } else {
      showToast("Gagal menyimpan kategori", "err");
    }
    setSavingCat(false);
  };

  const confirmDeleteCat = async () => {
    if (!deletingCat) return;
    setDeletingCatId(true);
    const res = await fetch(`/api/financial-categories/${deletingCat.id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Kategori berhasil dihapus!");
      setDeletingCat(null);
      load();
    } else {
      showToast("Gagal menghapus kategori", "err");
    }
    setDeletingCatId(false);
  };

  const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];
  const MONTH_NAMES = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

  // ── Render ──
  return (
    <div className="animate-in">
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800 }} className="gradient-text">Laporan Finansial</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Pencatatan cashflow — pemasukan & pengeluaran</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm" onClick={openAddCat} title="Kelola Kategori">
            🏷️ Kategori
          </button>
          <button className="btn btn-secondary btn-sm" onClick={load}><Icons.Refresh /></button>
          {canCreate && (
            <button className="btn btn-primary btn-sm" onClick={openAddTx}>
              <Icons.Plus /> Tambah Transaksi
            </button>
          )}
        </div>
      </div>

      {/* ── Saldo Summary ── */}
      <SaldoCard transactions={transactions} />

      {/* ── Tab Toggle + Filters — single compact toolbar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 12, padding: "8px 12px", flexWrap: "wrap",
      }}>
        {/* Segmented tab */}
        <div style={{ display: "inline-flex", background: "var(--bg-card-2)", padding: 3, borderRadius: 9, border: "1px solid var(--border)", gap: 3, flexShrink: 0 }}>
          {(["PEMASUKAN", "PENGELUARAN"] as const).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setFilterKat(""); }}
              style={{
                padding: "7px 18px", borderRadius: 7, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
                background: activeTab === tab
                  ? tab === "PEMASUKAN" ? "rgba(16,185,129,0.22)" : "rgba(239,68,68,0.2)"
                  : "transparent",
                color: activeTab === tab
                  ? tab === "PEMASUKAN" ? "#10b981" : "#ef4444"
                  : "var(--text-muted)",
                transition: "all 0.18s",
              }}>
              {tab === "PEMASUKAN" ? "💰 Pemasukan" : "💸 Pengeluaran"}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: "var(--border)", flexShrink: 0 }} />

        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 160px", minWidth: 140 }}>
          <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}><Icons.Search /></span>
          <input className="input" style={{ paddingLeft: 30, height: 36, fontSize: 13, width: "100%", borderRadius: 8 }}
            placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Kategori dropdown */}
        <select className="input" style={{ height: 36, fontSize: 13, borderRadius: 8, paddingRight: 28, minWidth: 130, maxWidth: 160 }}
          value={filterKat} onChange={e => setFilterKat(e.target.value)}>
          <option value="">Kategori</option>
          {tabCategories.map(c => <option key={c.id} value={String(c.id)}>{c.nama}</option>)}
        </select>

        {/* Tahun dropdown */}
        <select className="input" style={{ height: 36, fontSize: 13, borderRadius: 8, minWidth: 96, maxWidth: 116 }}
          value={filterTahun} onChange={e => setFilterTahun(e.target.value)}>
          <option value="">Tahun</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {/* Bulan dropdown */}
        <select className="input" style={{ height: 36, fontSize: 13, borderRadius: 8, minWidth: 108, maxWidth: 128 }}
          value={filterBulan} onChange={e => setFilterBulan(e.target.value)}>
          <option value="">Bulan</option>
          {MONTHS.map((m, i) => <option key={m} value={m}>{MONTH_NAMES[i]}</option>)}
        </select>


        {/* Active filter chips + Reset */}
        {(search || filterKat || filterTahun || filterBulan) && (
          <button
            onClick={() => { setSearch(""); setFilterKat(""); setFilterTahun(""); setFilterBulan(""); }}
            style={{
              display: "flex", alignItems: "center", gap: 5, height: 32,
              padding: "0 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)",
              background: "rgba(239,68,68,0.08)", color: "#ef4444",
              fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0,
              transition: "all 0.15s",
            }}>
            ✕ Reset
          </button>
        )}
      </div>


      {/* ── Table ── */}
      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 44 }} />)}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: "center", color: "var(--text-subtle)" }}>#</th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("tanggal")}>
                    Tanggal <SortIcon sortConfig={sortConfig} columnKey="tanggal" />
                  </th>
                  <th>Kategori</th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("nominal")}>
                    Nominal <SortIcon sortConfig={sortConfig} columnKey="nominal" />
                  </th>
                  <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("detail")}>
                    Detail <SortIcon sortConfig={sortConfig} columnKey="detail" />
                  </th>
                  <th>Deskripsi / Note</th>
                  {(canUpdate || canDelete) && <th style={{ width: 90 }}>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((tx, idx) => (
                  <tr key={tx.id}>
                    <td style={{ textAlign: "center", width: 44 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-subtle)", background: "var(--bg-card-2)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 7px" }}>
                        {idx + 1}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{fmtDate(tx.tanggal)}</td>
                    <td>
                      {tx.kategori ? (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                          background: `${tx.kategori.warna}22`,
                          border: `1px solid ${tx.kategori.warna}55`,
                          color: tx.kategori.warna,
                        }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: tx.kategori.warna, flexShrink: 0 }} />
                          {tx.kategori.nama}
                        </span>
                      ) : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ fontWeight: 700, color: activeTab === "PEMASUKAN" ? "#10b981" : "#ef4444", fontSize: 14, whiteSpace: "nowrap" }}>
                      {activeTab === "PEMASUKAN" ? "+" : "−"} {fmtRp(Number(tx.nominal))}
                    </td>
                    <td style={{ fontSize: 13, color: "var(--text-primary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tx.detail ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tx.deskripsi ?? "—"}
                    </td>
                    {(canUpdate || canDelete) && (
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {canUpdate && <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEditTx(tx)}><Icons.Edit /></button>}
                          {canDelete && <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeletingTx(tx)}><Icons.Trash /></button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {sortedItems.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
                      <div style={{ fontSize: 40, marginBottom: 10 }}>{activeTab === "PEMASUKAN" ? "💰" : "💸"}</div>
                      <p style={{ fontWeight: 600, marginBottom: 4 }}>Belum ada data {activeTab === "PEMASUKAN" ? "pemasukan" : "pengeluaran"}</p>
                      <p style={{ fontSize: 12 }}>Klik "Tambah Transaksi" untuk menambahkan data baru</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row count */}
      {!loading && sortedItems.length > 0 && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10, paddingLeft: 4 }}>
          Menampilkan {sortedItems.length} dari {filtered.length} transaksi
        </p>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ── Modal: Add / Edit Transaksi ── */}
      {showTxModal && (
        <Modal
          title={editingTx ? `Edit ${activeTab === "PEMASUKAN" ? "Pemasukan" : "Pengeluaran"}` : `Tambah ${activeTab === "PEMASUKAN" ? "Pemasukan" : "Pengeluaran"}`}
          onClose={() => { setShowTxModal(false); setEditingTx(null); }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Tipe toggle in modal */}
            {!editingTx && (
              <Field label="Tipe Transaksi">
                <div style={{ display: "inline-flex", background: "var(--bg-card-2)", padding: 4, borderRadius: 10, border: "1px solid var(--border)", gap: 4 }}>
                  {(["PEMASUKAN", "PENGELUARAN"] as const).map(t => (
                    <button key={t} onClick={() => setTxForm(f => ({ ...f, tipe: t, kategori_id: "" }))}
                      style={{
                        padding: "7px 20px", borderRadius: 7, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
                        background: txForm.tipe === t
                          ? t === "PEMASUKAN" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.18)"
                          : "transparent",
                        color: txForm.tipe === t
                          ? t === "PEMASUKAN" ? "#10b981" : "#ef4444"
                          : "var(--text-muted)",
                        transition: "all 0.15s",
                      }}>
                      {t === "PEMASUKAN" ? "💰 Pemasukan" : "💸 Pengeluaran"}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            <Field label="Tanggal" required>
              <input className="input" type="date" value={txForm.tanggal} onChange={e => setTxForm(f => ({ ...f, tanggal: e.target.value }))} />
            </Field>

            <Field label="Nominal (Rp)" required>
              <input className="input" type="number" min="0" step="100"
                placeholder="0"
                value={txForm.nominal}
                onChange={e => setTxForm(f => ({ ...f, nominal: e.target.value }))} />
            </Field>

            <Field label="Kategori">
              <div style={{ display: "flex", gap: 8 }}>
                <select className="input" style={{ flex: 1 }} value={txForm.kategori_id}
                  onChange={e => setTxForm(f => ({ ...f, kategori_id: e.target.value }))}>
                  <option value="">— Pilih Kategori —</option>
                  {categories.filter(c => c.tipe === txForm.tipe).map(c => (
                    <option key={c.id} value={String(c.id)}>{c.nama}</option>
                  ))}
                </select>
                <button className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }} onClick={() => { setShowTxModal(false); openAddCat(); }}>
                  + Kategori
                </button>
              </div>
            </Field>

            <Field label="Detail">
              <input className="input" placeholder="Misal: Beli bahan beading, Workshop Juni..." value={txForm.detail} onChange={e => setTxForm(f => ({ ...f, detail: e.target.value }))} />
            </Field>

            <Field label="Deskripsi / Note">
              <textarea className="input" rows={3} placeholder="Catatan tambahan (opsional)..."
                style={{ resize: "vertical", fontFamily: "inherit", fontSize: 13 }}
                value={txForm.deskripsi} onChange={e => setTxForm(f => ({ ...f, deskripsi: e.target.value }))} />
            </Field>

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveTx} disabled={savingTx}>
                <Icons.Save /> {savingTx ? "Menyimpan..." : "Simpan"}
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowTxModal(false); setEditingTx(null); }}>Batal</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Konfirmasi Hapus Transaksi ── */}
      {deletingTx && (
        <Modal title="Hapus Transaksi" onClose={() => setDeletingTx(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>🗑️</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{fmtRp(Number(deletingTx.nominal))}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {deletingTx.tipe} • {deletingTx.kategori?.nama ?? "Tanpa Kategori"} • {fmtDate(deletingTx.tanggal)}
                  </p>
                </div>
              </div>
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 13, color: "#f59e0b", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <span>Yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan.</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-sm" disabled={deletingTxId}
                style={{ flex: 1, justifyContent: "center", background: "linear-gradient(135deg,rgba(239,68,68,0.2),rgba(220,38,38,0.15))", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)", padding: "10px 0", fontWeight: 700 }}
                onClick={confirmDeleteTx}>
                {deletingTxId ? "Menghapus..." : "Ya, Hapus"}
              </button>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center", padding: "10px 0" }} onClick={() => setDeletingTx(null)}>Batal</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ── Modal: Kelola Kategori ── */}
      {showCatModal && (
        <Modal title="🏷️ Kelola Kategori" onClose={() => { setShowCatModal(false); setEditingCat(null); setCatForm({ nama: "", tipe: activeTab, warna: "#38bdf8" }); load(); }} wide>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Form tambah/edit */}
            <div style={{ padding: 16, borderRadius: 12, background: "var(--bg-card-2)", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
                {editingCat ? "✏️ Edit Kategori" : "➕ Tambah Kategori Baru"}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Field label="Nama Kategori" required>
                  <input className="input" placeholder="Nama kategori..." value={catForm.nama} onChange={e => setCatForm(f => ({ ...f, nama: e.target.value }))} />
                </Field>
                <Field label="Tipe">
                  <div style={{ display: "inline-flex", background: "var(--bg-card)", padding: 3, borderRadius: 8, border: "1px solid var(--border)", gap: 3 }}>
                    {(["PEMASUKAN", "PENGELUARAN"] as const).map(t => (
                      <button key={t} onClick={() => setCatForm(f => ({ ...f, tipe: t }))}
                        style={{
                          padding: "6px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
                          background: catForm.tipe === t
                            ? t === "PEMASUKAN" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.18)"
                            : "transparent",
                          color: catForm.tipe === t
                            ? t === "PEMASUKAN" ? "#10b981" : "#ef4444"
                            : "var(--text-muted)",
                          transition: "all 0.15s",
                        }}>
                        {t === "PEMASUKAN" ? "💰 Pemasukan" : "💸 Pengeluaran"}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Warna">
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {COLOR_PALETTE.map(c => (
                      <button key={c} onClick={() => setCatForm(f => ({ ...f, warna: c }))}
                        style={{
                          width: 28, height: 28, borderRadius: "50%", background: c, border: "none", cursor: "pointer",
                          outline: catForm.warna === c ? `3px solid ${c}` : "3px solid transparent",
                          outlineOffset: 2, transition: "all 0.15s", transform: catForm.warna === c ? "scale(1.2)" : "scale(1)",
                        }} />
                    ))}
                  </div>
                </Field>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={saveCat} disabled={savingCat || !catForm.nama.trim()}>
                    <Icons.Save /> {savingCat ? "Menyimpan..." : editingCat ? "Update" : "Tambah"}
                  </button>
                  {editingCat && (
                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditingCat(null); setCatForm({ nama: "", tipe: activeTab, warna: "#38bdf8" }); }}>
                      Batal Edit
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* List kategori */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Kategori yang ada</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                {categories.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>Belum ada kategori.</p>}
                {(["PEMASUKAN", "PENGELUARAN"] as const).map(tipe => {
                  const cats = categories.filter(c => c.tipe === tipe);
                  if (cats.length === 0) return null;
                  return (
                    <div key={tipe}>
                      <p style={{ fontSize: 10, fontWeight: 800, color: tipe === "PEMASUKAN" ? "#10b981" : "#ef4444", marginBottom: 4, marginTop: 6, letterSpacing: "0.08em" }}>
                        — {tipe}
                      </p>
                      {cats.map(c => (
                        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: editingCat?.id === c.id ? "var(--bg-hover)" : "var(--bg-card-2)", border: "1px solid var(--border)", marginBottom: 4 }}>
                          <span style={{ width: 12, height: 12, borderRadius: "50%", background: c.warna, flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.nama}</span>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEditCat(c)}><Icons.Edit /></button>
                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeletingCat(c)}><Icons.Trash /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Konfirmasi Hapus Kategori ── */}
      {deletingCat && (
        <Modal title="Hapus Kategori" onClose={() => setDeletingCat(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", background: deletingCat.warna }} />
                <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{deletingCat.nama}</p>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>({deletingCat.tipe})</span>
              </div>
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 13, color: "#f59e0b", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <span>Transaksi yang menggunakan kategori ini akan kehilangan kaitannya. Yakin hapus?</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-sm" disabled={deletingCatId}
                style={{ flex: 1, justifyContent: "center", background: "linear-gradient(135deg,rgba(239,68,68,0.2),rgba(220,38,38,0.15))", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)", padding: "10px 0", fontWeight: 700 }}
                onClick={confirmDeleteCat}>
                {deletingCatId ? "Menghapus..." : "Ya, Hapus"}
              </button>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center", padding: "10px 0" }} onClick={() => setDeletingCat(null)}>Batal</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
