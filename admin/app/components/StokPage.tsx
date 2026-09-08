"use client";
import { useState, useCallback, useEffect } from "react";
import { Icons, Modal, Field, fmtRp, SortIcon, TablePaginationTop, TablePaginationBottom } from "./ui";
import { usePagination } from "@/lib/usePagination";
import { useSort } from "@/lib/useSort";
import { useAccess } from "./AccessContext";

type StockRow = {
  id: number;
  item_id: number;
  qty_available: number;
  qty_sold: number;
  qty_reserved: number;
  updated_at: string;
  item: { id: number; nama: string; satuan: string; harga_normal: number; harga_promo: number | null; is_active: boolean; item_type: { nama: string; icon: string } | null };
};

type WorkshopSalesRow = {
  id: number;
  nama_workshop: string;
  is_active: boolean;
  tiket_terjual: number;
};

type ItemRow = {
  id: number;
  nama: string;
  satuan: string;
  harga_normal: number;
  is_active: boolean;
  item_type: { nama: string; icon: string } | null;
  stock?: { qty_available: number; qty_sold: number } | null;
};

type EditMode = "set" | "add" | "subtract";

export default function StokPage() {
  const hasAccess = useAccess();
  const canCreate = hasAccess("produk_ws", "create");
  const canUpdate = hasAccess("produk_ws", "update");
  const canDelete = hasAccess("produk_ws", "delete");
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopSalesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StockRow | null>(null);
  const [addingFrom, setAddingFrom] = useState<ItemRow | null>(null); // item yg belum punya stok
  const [qty, setQty] = useState("");
  const [editMode, setEditMode] = useState<EditMode>("set");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<number | null>(null);
  const [resettingStok, setResettingStok] = useState<{item_id: number; nama: string} | null>(null);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"ALL" | "LOW_STOCK" | "TOP_SOLD">("ALL");
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [sr, ir, wr] = await Promise.all([fetch("/api/stocks"), fetch("/api/items"), fetch("/api/workshops/sales")]);
    if (sr.ok) setStocks(await sr.json());
    if (ir.ok) setItems(await ir.json());
    if (wr.ok) setWorkshops(await wr.json());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Items yang belum punya stok (tidak muncul di stocks)
  const stockedIds = new Set(stocks.map(s => s.item_id));
  const unstockedItems = items.filter(i => !stockedIds.has(i.id) && i.is_active);

  // Edit existing stok
  const openEdit = (s: StockRow) => {
    setEditing(s);
    setAddingFrom(null);
    setQty("0");
    setEditMode("add");
  };

  // Init stok dari item katalog
  const openAddFrom = (item: ItemRow) => {
    setAddingFrom(item);
    setEditing(null);
    setQty("0");
    setEditMode("set");
  };

  const save = async () => {
    setSaving(true);
    if (addingFrom) {
      // Create new stock
      const r = await fetch("/api/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: addingFrom.id, qty_available: Number(qty) }),
      });
      if (r.ok) { showToast(`Stok "${addingFrom.nama}" berhasil diinisialisasi!`); setAddingFrom(null); load(); }
      else { const d = await r.json(); showToast(d.error ?? "Gagal membuat stok", "err"); }
    } else if (editing) {
      const body = editMode === "set"
        ? { qty_available: Number(qty) }
        : { mode: "adjust", adjust_by: editMode === "add" ? Number(qty) : -Number(qty) };
      const r = await fetch(`/api/stocks/${editing.item_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) { showToast(`Stok "${editing.item?.nama}" berhasil diupdate!`); setEditing(null); load(); }
      else { const d = await r.json(); showToast(d.error ?? "Gagal update stok", "err"); }
    }
    setSaving(false);
  };

  const resetStok = async () => {
    if (!resettingStok) return;
    setResetting(resettingStok.item_id);
    const r = await fetch(`/api/stocks/${resettingStok.item_id}`, { method: "DELETE" });
    if (r.ok) showToast(`Stok ${resettingStok.nama} direset ke 0`);
    else showToast("Gagal reset stok", "err");
    setResetting(null);
    setResettingStok(null);
    load();
  };

  const previewQty = () => {
    const n = Number(qty) || 0;
    if (editMode === "set" || addingFrom) return n;
    if (!editing) return n;
    if (editMode === "add") return editing.qty_available + n;
    return Math.max(0, editing.qty_available - n);
  };

  const lowStock = stocks.filter(s => s.qty_available <= 3 && (s.item?.is_active ?? true)).length;
  const totalSold = stocks.reduce((sum, s) => sum + s.qty_sold, 0);

  const filtered = stocks.filter(s => {
    const matchesSearch = !search || s.item?.nama?.toLowerCase().includes(search.toLowerCase());
    let matchesFilter = true;
    if (stockFilter === "LOW_STOCK") {
      matchesFilter = s.qty_available <= 3 && (s.item?.is_active ?? true);
    } else if (stockFilter === "TOP_SOLD") {
      matchesFilter = s.qty_sold > 0;
    }
    return matchesSearch && matchesFilter;
  });

  if (stockFilter === "TOP_SOLD") {
    filtered.sort((a, b) => b.qty_sold - a.qty_sold);
  }

  const { sortedItems: sortedFiltered, handleSort, sortConfig } = useSort(filtered);

  const pagination = usePagination(sortedFiltered);

  const modalItem = addingFrom ?? editing?.item;
  const modalTitle = addingFrom ? `Inisialisasi Stok: ${addingFrom.nama}` : editing ? `Update Stok: ${editing.item?.nama}` : "";

  return (
    <div className="animate-in">
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: toast.type === "ok" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
          border: `1px solid ${toast.type === "ok" ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
          color: toast.type === "ok" ? "#34d399" : "#f87171",
          backdropFilter: "blur(8px)",
        }}>
          {toast.type === "ok" ? "✓ " : "⚠ "}{toast.msg}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Stok & Kuota</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{stocks.length} item terlacak • {totalSold} total terjual</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}><Icons.Refresh /> Refresh</button>
      </div>

      {/* ─── SECTION 1: Produk yang belum punya stok ─── */}
      {canCreate && unstockedItems.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 20, border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <p style={{ fontWeight: 700, fontSize: 14, color: "#f59e0b" }}>{unstockedItems.length} Produk Belum Diinisialisasi Stok</p>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            Produk berikut ada di Katalog tapi belum memiliki data stok. Klik <strong>+ Tambah Stok</strong> untuk inisialisasi.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {unstockedItems.map(item => (
              <div key={item.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", borderRadius: 8,
                background: "var(--bg-card-2)", border: "1px solid var(--border)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13 }}>{item.item_type?.icon ?? "📦"}</span>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>{item.nama}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.item_type?.nama ?? "—"} • {fmtRp(item.harga_normal)}</p>
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => openAddFrom(item)}>
                  <Icons.Plus /> Tambah Stok
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Summary cards (Interactive Filter) ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Total Item", value: String(stocks.length), color: "#a78bfa", bg: "rgba(124,58,237,0.15)", icon: <Icons.Package />, filterKey: "ALL" as const },
          { label: "Total Terjual", value: String(totalSold), color: "#34d399", bg: "rgba(52,211,153,0.15)", icon: <Icons.TrendingUp />, filterKey: "TOP_SOLD" as const },
          { label: "Stok Kritis (≤ 3)", value: String(lowStock), color: lowStock > 0 ? "#f87171" : "var(--text-muted)", bg: "rgba(239,68,68,0.15)", icon: <Icons.AlertTriangle />, filterKey: "LOW_STOCK" as const },
        ].map(card => {
          const isActive = stockFilter === card.filterKey;
          return (
            <div
              key={card.label}
              className="stat-card"
              style={{
                cursor: "pointer",
                transition: "all 0.2s ease",
                border: isActive ? `1.5px solid ${card.color}` : "1px solid var(--border)",
                boxShadow: isActive ? `0 0 16px ${card.color}35` : "none",
                background: isActive ? `${card.color}10` : "var(--bg-card)",
              }}
              onClick={() => setStockFilter(card.filterKey)}
              title={`Klik untuk memfilter: ${card.label}`}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                <div className="stat-icon" style={{ background: card.bg }}>
                  <span style={{ color: card.color }}>{card.icon}</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${card.color}20`, color: card.color }}>
                  {isActive ? "Aktif" : "Lihat →"}
                </span>
              </div>
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{card.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter Status Warning Banner */}
      {stockFilter === "LOW_STOCK" && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", color: "#f87171", fontSize: 13 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Icons.AlertTriangle />
            <span>Memfilter <strong>Stok Kritis (≤ 3 Pcs)</strong>. Terdapat {lowStock} item perlu restock.</span>
          </div>
          <button className="btn btn-secondary btn-sm" style={{ padding: "3px 10px", fontSize: 11 }} onClick={() => setStockFilter("ALL")}>Tampilkan Semua</button>
        </div>
      )}

      {stockFilter === "TOP_SOLD" && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", color: "#34d399", fontSize: 13 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Icons.TrendingUp />
            <span>Memfilter <strong>Item Terjual</strong> (diurutkan berdasarkan penjualan tertinggi).</span>
          </div>
          <button className="btn btn-secondary btn-sm" style={{ padding: "3px 10px", fontSize: 11 }} onClick={() => setStockFilter("ALL")}>Tampilkan Semua</button>
        </div>
      )}

      <div style={{ position: "relative", marginBottom: 14 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}><Icons.Search /></span>
        <input className="input" style={{ paddingLeft: 36 }} placeholder="Cari nama item..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* ─── SECTION 2: Stok & Kuota Table ─── */}
      <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {stockFilter === "LOW_STOCK" ? "Daftar Stok Kritis (≤ 3 Pcs)" : stockFilter === "TOP_SOLD" ? "Daftar Terjual Terbanyak" : "Stok & Kuota Terkini"}
        </span>
        <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
      </div>

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
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 52 }} />)}
          </div>
        ) : (
          <table className="data-table">
            <thead><tr>
              <th style={{ width: 44, textAlign: "center", color: "var(--text-subtle)" }}>#</th>
              <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("item.nama")}>Item <SortIcon sortConfig={sortConfig} columnKey="item.nama" /></th>
              <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("item.item_type.nama")}>Tipe <SortIcon sortConfig={sortConfig} columnKey="item.item_type.nama" /></th>
              <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("item.harga_normal")}>Harga <SortIcon sortConfig={sortConfig} columnKey="item.harga_normal" /></th>
              <th style={{ textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("qty_available")}>Tersedia <SortIcon sortConfig={sortConfig} columnKey="qty_available" /></th>
              <th style={{ textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("qty_sold")}>Terjual <SortIcon sortConfig={sortConfig} columnKey="qty_sold" /></th>
              <th style={{ textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("qty_reserved")}>Reserved <SortIcon sortConfig={sortConfig} columnKey="qty_reserved" /></th>
              {(canUpdate || canDelete) && <th style={{ width: 140 }}>Aksi</th>}
            </tr></thead>
            <tbody>
              {pagination.paginatedItems.map((s, idx) => (
                <tr key={s.id}>
                  <td style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-subtle)", background: "var(--bg-card-2)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 7px" }}>
                      {pagination.startIndex + idx}
                    </span>
                  </td>
                  <td>
                    <p style={{ fontWeight: 600, color: s.item?.is_active ? "var(--text-primary)" : "var(--text-muted)" }}>{s.item?.nama ?? `Item #${s.item_id}`}</p>
                    {!s.item?.is_active && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>nonaktif</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>{s.item?.item_type ? `${s.item.item_type.icon} ${s.item.item_type.nama}` : "—"}</td>
                  <td style={{ fontSize: 12 }}>
                    {s.item?.harga_promo ? (
                      <>
                        <span style={{ color: "#34d399", fontWeight: 600 }}>{fmtRp(s.item.harga_promo)}</span>
                        <span style={{ color: "var(--text-muted)", textDecoration: "line-through", marginLeft: 6, fontSize: 11 }}>{fmtRp(s.item.harga_normal)}</span>
                      </>
                    ) : <span style={{ fontWeight: 600 }}>{fmtRp(s.item?.harga_normal ?? 0)}</span>}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: s.qty_available <= 3 ? "#f87171" : s.qty_available <= 10 ? "#fbbf24" : "#34d399" }}>{s.qty_available}</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", display: "block" }}>{s.item?.satuan ?? "Pcs"}</span>
                  </td>
                  <td style={{ textAlign: "center", color: "var(--text-secondary)" }}>{s.qty_sold}</td>
                  <td style={{ textAlign: "center", color: "#fbbf24" }}>{s.qty_reserved}</td>
                  {(canUpdate || canDelete) && (
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        {canUpdate && (
                          <button className="btn btn-primary btn-sm" onClick={() => openEdit(s)}>
                            <Icons.Edit /> Update
                          </button>
                        )}
                        {canDelete && (
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => setResettingStok({ item_id: s.item_id, nama: s.item?.nama ?? "" })} disabled={resetting === s.item_id} title="Reset stok ke 0">
                              {resetting === s.item_id ? <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> : <Icons.Trash />}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
                    {stockFilter === "LOW_STOCK"
                      ? "✅ Semua stok dalam kondisi aman (tidak ada stok kritis ≤ 3)."
                      : stockFilter === "TOP_SOLD"
                      ? "📦 Belum ada item yang terjual."
                      : "📦 Tidak ada data stok"
                    }
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

      {/* ─── SECTION 3: Workshop Ticket Sales ─── */}
      <div style={{ marginTop: 32, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Penjualan Tiket Workshop
        </span>
        <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
      </div>

      <div className="card" style={{ padding: 16 }}>
        {loading ? (
          <div className="skeleton" style={{ height: 100 }} />
        ) : workshops.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", fontSize: 13 }}>Belum ada data workshop.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {workshops.map(ws => {
              return (
                <div key={ws.id} style={{ padding: 16, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card-2)", position: "relative", overflow: "hidden", transition: "transform 0.2s, box-shadow 0.2s", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)", flex: 1, paddingRight: 8, lineHeight: 1.4 }}>{ws.nama_workshop}</p>
                      <span className={`badge ${ws.is_active ? "badge-active" : "badge-closed"}`} style={{ flexShrink: 0, padding: "4px 8px", fontSize: 10 }}>
                        {ws.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>
                    
                    <div style={{ background: "rgba(56,189,248,0.08)", borderRadius: 8, padding: "16px 12px", textAlign: "center", border: "1px solid rgba(56,189,248,0.2)" }}>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Total Terjual</p>
                      <p style={{ fontSize: 28, fontWeight: 800, color: "#38bdf8", marginTop: 6 }}>{ws.tiket_terjual}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Modal: Update / Init Stok ─── */}
      {(!!editing || !!addingFrom) && (
        <Modal title={modalTitle} onClose={() => { setEditing(null); setAddingFrom(null); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Current info */}
            <div style={{ padding: 14, borderRadius: 8, background: "var(--bg-card-2)", border: "1px solid var(--border)" }}>
              {addingFrom ? (
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Inisialisasi stok pertama kali untuk <strong style={{ color: "var(--text-primary)" }}>{addingFrom.nama}</strong>.
                  Masukkan jumlah stok awal yang tersedia.
                </p>
              ) : editing && (
                <>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Stok saat ini: <strong style={{ color: "var(--text-primary)", fontSize: 16 }}>{editing.qty_available} {editing.item?.satuan}</strong></p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Terjual: {editing.qty_sold} • Reserved: {editing.qty_reserved}</p>
                </>
              )}
            </div>

            {/* Mode selector — hanya untuk update, bukan init */}
            {editing && (
              <Field label="Mode Update">
                <div style={{ display: "flex", gap: 8 }}>
                  {([["set", "⚙ Set Langsung"], ["add", "+ Tambah"], ["subtract", "− Kurangi"]] as [EditMode, string][]).map(([m, label]) => (
                    <button key={m} className={`btn btn-sm ${editMode === m ? "btn-primary" : "btn-secondary"}`} style={{ flex: 1, justifyContent: "center" }} onClick={() => setEditMode(m)}>
                      {label}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            <Field label={addingFrom ? "Jumlah Stok Awal" : editMode === "set" ? "Jumlah Stok Baru" : editMode === "add" ? "Tambah Berapa?" : "Kurangi Berapa?"} required>
              <input className="input" type="number" min="0" value={qty} onChange={e => setQty(e.target.value)} placeholder="Masukkan jumlah..." autoFocus />
            </Field>

            {/* Preview */}
            {qty !== "" && qty !== "0" && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.2)", fontSize: 13 }}>
                Hasil: <strong style={{ color: "#38bdf8" }}>{previewQty()} {(addingFrom ?? editing?.item)?.satuan ?? "Pcs"}</strong>
                {editing && editMode !== "set" && <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>(dari {editing.qty_available})</span>}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={saving || qty === ""}>
                <Icons.Save /> {saving ? "Menyimpan..." : addingFrom ? "Inisialisasi Stok" : "Update Stok"}
              </button>
              <button className="btn btn-secondary" onClick={() => { setEditing(null); setAddingFrom(null); }}>Batal</button>
            </div>
          </div>
        </Modal>
      )}

      {resettingStok && (
        <Modal title="Reset Stok" onClose={() => setResettingStok(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>🗑️</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{resettingStok.nama}</p>
                </div>
              </div>
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 13, color: "#f59e0b", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <span>Anda yakin ingin mereset stok ini kembali ke 0? Riwayat penjualan tidak akan hilang.</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-sm" style={{ flex: 1, justifyContent: "center", background: "linear-gradient(135deg,rgba(239,68,68,0.2),rgba(220,38,38,0.15))", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)", padding: "10px 0", fontWeight: 700 }} onClick={resetStok}>Ya, Reset</button>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center", padding: "10px 0" }} onClick={() => setResettingStok(null)}>Batal</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
