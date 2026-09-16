"use client";

import { useEffect, useState, useCallback } from "react";
import type { PreOrder } from "@/lib/supabase";
import { Icons, StatCard, useToast, SortIcon, TablePaginationTop, TablePaginationBottom, Modal } from "./ui";
import { useSort } from "@/lib/useSort";
import { usePagination } from "@/lib/usePagination";

type Props = {
  onConvertToInvoice: (preOrder: PreOrder) => void;
};

export default function PreOrderListPage({ onConvertToInvoice }: Props) {
  const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING" | "DIPROSES" | "DIBATALKAN">("ALL");
  const [search, setSearch] = useState("");
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancelModalItem, setCancelModalItem] = useState<PreOrder | null>(null);
  const { showToast } = useToast();

  const fetchPreOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pre-orders");
      if (!res.ok) throw new Error("Gagal mengambil data pre-order");
      const data = await res.json();
      setPreOrders(data);
    } catch (err: any) {
      showToast(err.message || "Gagal memuat data pre-order", "err");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchPreOrders();
  }, [fetchPreOrders]);

  const filtered = preOrders.filter((item) => {
    if (filterStatus !== "ALL" && item.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = item.nama_pembeli.toLowerCase().includes(q);
      const matchUsername = (item.telegram_username || "").toLowerCase().includes(q);
      const matchRincian = item.rincian_pesanan.toLowerCase().includes(q);
      const matchCatatan = (item.catatan || "").toLowerCase().includes(q);
      return matchName || matchUsername || matchRincian || matchCatatan;
    }
    return true;
  });

  const { sortedItems, handleSort, sortConfig } = useSort<PreOrder>(filtered, { key: "created_at", direction: "desc" });
  const pagination = usePagination(sortedItems);

  const totalCount = preOrders.length;
  const pendingCount = preOrders.filter((p) => p.status === "PENDING").length;
  const diprosesCount = preOrders.filter((p) => p.status === "DIPROSES").length;
  const dibatalkanCount = preOrders.filter((p) => p.status === "DIBATALKAN").length;

  const handleCancelOrder = async () => {
    if (!cancelModalItem) return;
    setCancellingId(cancelModalItem.id);
    try {
      const res = await fetch(`/api/pre-orders/${cancelModalItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DIBATALKAN" }),
      });
      if (!res.ok) throw new Error("Gagal membatalkan pesanan");
      showToast(`Pre-order #${cancelModalItem.id} berhasil dibatalkan`, "ok");
      setCancelModalItem(null);
      fetchPreOrders();
    } catch (err: any) {
      showToast(err.message || "Terjadi kesalahan saat membatalkan", "err");
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status: PreOrder["status"]) => {
    switch (status) {
      case "PENDING":
        return <span style={{ padding: "4px 10px", borderRadius: 12, background: "rgba(251, 191, 36, 0.15)", color: "#fbbf24", fontWeight: 600, fontSize: 12, border: "1px solid rgba(251, 191, 36, 0.3)" }}>⏳ PENDING</span>;
      case "DIPROSES":
        return <span style={{ padding: "4px 10px", borderRadius: 12, background: "rgba(52, 211, 153, 0.15)", color: "#34d399", fontWeight: 600, fontSize: 12, border: "1px solid rgba(52, 211, 153, 0.3)" }}>✅ DIPROSES</span>;
      case "DIBATALKAN":
        return <span style={{ padding: "4px 10px", borderRadius: 12, background: "rgba(248, 113, 113, 0.15)", color: "#f87171", fontWeight: 600, fontSize: 12, border: "1px solid rgba(248, 113, 113, 0.3)" }}>❌ DIBATALKAN</span>;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "24px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f3f4f6", display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
            <span style={{ fontSize: 28 }}>🤖</span> Daftar Pre-Order Masuk (Telegram Bot)
          </h1>
          <p style={{ color: "#9ca3af", fontSize: 14, marginTop: 4, margin: 0 }}>
            Antrean pesanan sementara yang diinput oleh tim DynoBoo melalui Bot Telegram.
          </p>
        </div>
        <button
          onClick={fetchPreOrders}
          className="btn btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px" }}
        >
          <span>🔄</span> Refresh Data
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <StatCard label="Total Pre-Order" value={totalCount} icon={<Icons.Receipt />} color="#8b5cf6" bg="rgba(139, 92, 246, 0.1)" />
        <StatCard label="Menunggu (Pending)" value={pendingCount} icon={<Icons.Orders />} color="#fbbf24" bg="rgba(251, 191, 36, 0.1)" />
        <StatCard label="Sudah Diproses" value={diprosesCount} icon={<Icons.CheckCircle />} color="#34d399" bg="rgba(52, 211, 153, 0.1)" />
        <StatCard label="Dibatalkan" value={dibatalkanCount} icon={<Icons.Trash />} color="#f87171" bg="rgba(248, 113, 113, 0.1)" />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", background: "#1f2937", padding: 16, borderRadius: 12, border: "1px solid #374151" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {(["ALL", "PENDING", "DIPROSES", "DIBATALKAN"] as const).map((st) => (
            <button
              key={st}
              onClick={() => { setFilterStatus(st); pagination.handlePageChange(1); }}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s",
                background: filterStatus === st ? "#8b5cf6" : "#374151",
                color: filterStatus === st ? "#ffffff" : "#9ca3af",
              }}
            >
              {st === "ALL" ? "Semua" : st}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", minWidth: 260 }}>
          <input
            type="text"
            placeholder="Cari pembeli, username, rincian..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); pagination.handlePageChange(1); }}
            style={{
              width: "100%",
              padding: "8px 12px 8px 36px",
              borderRadius: 8,
              background: "#111827",
              border: "1px solid #374151",
              color: "#f3f4f6",
              fontSize: 13,
            }}
          />
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#6b7280" }}>🔍</span>
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <TablePaginationTop
          totalItems={pagination.totalItems}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          pageSize={pagination.pageSize}
          onPageSizeChange={pagination.handlePageSizeChange}
        />

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#111827", borderBottom: "1px solid #374151", color: "#9ca3af", fontSize: 13 }}>
                <th style={{ padding: "12px 16px", cursor: "pointer" }} onClick={() => handleSort("created_at")}>
                  Tanggal <SortIcon columnKey="created_at" sortConfig={sortConfig} />
                </th>
                <th style={{ padding: "12px 16px" }}>Pengirim</th>
                <th style={{ padding: "12px 16px", cursor: "pointer" }} onClick={() => handleSort("nama_pembeli")}>
                  Nama Pembeli <SortIcon columnKey="nama_pembeli" sortConfig={sortConfig} />
                </th>
                <th style={{ padding: "12px 16px" }}>Jenis Pesanan</th>
                <th style={{ padding: "12px 16px" }}>Rincian Pesanan</th>
                <th style={{ padding: "12px 16px" }}>Catatan</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 32, color: "#9ca3af" }}>
                    ⏳ Memuat data antrean pre-order...
                  </td>
                </tr>
              ) : pagination.paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 32, color: "#9ca3af" }}>
                    Belum ada data pre-order masuk.
                  </td>
                </tr>
              ) : (
                pagination.paginatedItems.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #374151", transition: "background 0.15s" }}>
                    <td style={{ padding: "14px 16px", color: "#d1d5db", whiteSpace: "nowrap" }}>
                      {new Date(item.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#a78bfa", fontWeight: 500 }}>
                      {item.telegram_username || "Tim DynoBoo"}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#f3f4f6", fontWeight: 600 }}>
                      {item.nama_pembeli}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        background: item.jenis_pesanan.toUpperCase().includes("WORKSHOP") ? "rgba(139, 92, 246, 0.2)" : "rgba(59, 130, 246, 0.2)",
                        color: item.jenis_pesanan.toUpperCase().includes("WORKSHOP") ? "#c084fc" : "#60a5fa",
                        border: "1px solid rgba(255,255,255,0.1)"
                      }}>
                        {item.jenis_pesanan}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", color: "#e5e7eb", maxWidth: 280 }}>
                      {item.rincian_pesanan}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#9ca3af", fontSize: 13, maxWidth: 200 }}>
                      {item.catatan || "-"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      {getStatusBadge(item.status)}
                      {item.invoice && (
                        <div style={{ fontSize: 11, color: "#34d399", marginTop: 4 }}>
                          📄 {item.invoice.invoice_no}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                      {item.status === "PENDING" ? (
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button
                            onClick={() => onConvertToInvoice(item)}
                            style={{
                              padding: "6px 14px",
                              borderRadius: 6,
                              background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                              color: "#ffffff",
                              fontWeight: 600,
                              fontSize: 12,
                              border: "none",
                              cursor: "pointer",
                              boxShadow: "0 2px 8px rgba(139, 92, 246, 0.3)",
                            }}
                          >
                            📄 Jadikan Invoice
                          </button>
                          <button
                            onClick={() => setCancelModalItem(item)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 6,
                              background: "rgba(239, 68, 68, 0.15)",
                              color: "#f87171",
                              fontWeight: 600,
                              fontSize: 12,
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              cursor: "pointer",
                            }}
                          >
                            Batalkan
                          </button>
                        </div>
                      ) : item.status === "DIPROSES" ? (
                        <span style={{ fontSize: 12, color: "#34d399", fontWeight: 500 }}>
                          Selesai Diprosos
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>Dibatalkan</span>
                      )}
                    </td>
                  </tr>
                ))
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
      </div>

      {cancelModalItem && (
        <Modal title="Konfirmasi Pembatalan Pre-Order" onClose={() => setCancelModalItem(null)}>
          <div style={{ padding: 8 }}>
            <p style={{ color: "#e5e7eb", fontSize: 14 }}>
              Apakah Anda yakin ingin membatalkan Pre-Order dari <strong>{cancelModalItem.nama_pembeli}</strong>?
            </p>
            <div style={{ background: "#111827", padding: 12, borderRadius: 8, margin: "12px 0", fontSize: 13, color: "#9ca3af" }}>
              <div><strong>Rincian:</strong> {cancelModalItem.rincian_pesanan}</div>
              <div><strong>Status:</strong> {cancelModalItem.status}</div>
            </div>
            <p style={{ color: "#f87171", fontSize: 12 }}>
              *Bot Telegram akan mengirim notifikasi pembatalan ke pengirim.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
              <button
                onClick={() => setCancelModalItem(null)}
                className="btn btn-secondary"
                disabled={cancellingId !== null}
              >
                Batal
              </button>
              <button
                onClick={handleCancelOrder}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  background: "#ef4444",
                  color: "#fff",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
                disabled={cancellingId !== null}
              >
                {cancellingId ? "Membatalkan..." : "Ya, Batalkan Pesanan"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}