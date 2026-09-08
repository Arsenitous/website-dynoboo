"use client";
import { useState, useCallback, useEffect } from "react";
import type { Loyalty, Invoice } from "@/lib/supabase";
import { Icons, Modal, Field, useToast, SortIcon, TablePaginationTop, TablePaginationBottom } from "./ui";
import { usePagination } from "@/lib/usePagination";
import { useSort } from "@/lib/useSort";
import { useAccess } from "./AccessContext";

type LoyaltyForm = {
  nama: string;
  no_hp: string;
  email: string;
  alamat: string;
  catatan: string;
  is_active: boolean;
};

const emptyForm: LoyaltyForm = {
  nama: "",
  no_hp: "",
  email: "",
  alamat: "",
  catatan: "",
  is_active: true,
};

export default function LoyaltyPage({ onNavigate }: { onNavigate: (page: any, data?: unknown) => void }) {
  const hasAccess = useAccess();
  const canCreate = hasAccess("loyalty", "create");
  const canUpdate = hasAccess("loyalty", "update");
  const canDelete = hasAccess("loyalty", "delete");
  const { showToast } = useToast();
  const [loyalties, setLoyalties] = useState<Loyalty[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Loyalty | null>(null);
  const [form, setForm] = useState<LoyaltyForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Loyalty | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [loyRes, invRes] = await Promise.all([
      fetch("/api/loyalty"),
      fetch("/api/invoices")
    ]);
    if (loyRes.ok) setLoyalties(await loyRes.json());
    if (invRes.ok) setInvoices(await invRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm(emptyForm);
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (c: Loyalty) => {
    setForm({
      nama: c.nama,
      no_hp: c.no_hp ?? "",
      email: c.email ?? "",
      alamat: c.alamat ?? "",
      catatan: c.catatan ?? "",
      is_active: c.is_active,
    });
    setEditing(c);
    setShowModal(true);
  };

  const save = async () => {
    if (!form.nama.trim()) return;
    setSaving(true);
    if (editing) {
      const res = await fetch(`/api/loyalty/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) showToast("Member berhasil diperbarui!");
      else showToast("Gagal memperbarui member", "err");
    } else {
      const res = await fetch("/api/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) showToast("Member berhasil ditambahkan!");
      else showToast("Gagal menambah member", "err");
    }
    setSaving(false);
    setShowModal(false);
    setEditing(null);
    load();
  };

  const del = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/loyalty/${deleteTarget.id}`, { method: "DELETE" });
    if (res.ok) showToast(`Member "${deleteTarget.nama}" berhasil dihapus!`);
    else showToast("Gagal menghapus member", "err");
    setDeleting(false);
    setDeleteTarget(null);
    load();
  };

  const dataWithTxCount = loyalties.map(c => {
    const txCount = invoices.filter(inv =>
      inv.status_pembayaran !== "CANCELLED" && (
        (inv.customer_name && inv.customer_name.toLowerCase() === c.nama.toLowerCase()) ||
        (c.no_hp && inv.customer_contact && inv.customer_contact.replace(/[^0-9]/g, "") === c.no_hp.replace(/[^0-9]/g, ""))
      )
    ).length;
    return { ...c, txCount };
  });

  const filtered = dataWithTxCount.filter(c => {
    const matchesSearch = c.nama.toLowerCase().includes(search.toLowerCase()) ||
      (c.no_hp ?? "").includes(search) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase());

    const matchesStatus = filterStatus === "ALL" ? true :
      filterStatus === "ACTIVE" ? c.is_active :
        !c.is_active;

    return matchesSearch && matchesStatus;
  });

  const { sortedItems: sortedFiltered, handleSort, sortConfig } = useSort(filtered);

  const pagination = usePagination(sortedFiltered);

  return (
    <>
      <div className="animate-in">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Loyalty Logbook</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              Direktori pelanggan setia — {loyalties.length} member terdaftar
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={load}><Icons.Refresh /> Refresh</button>
            {canCreate && (
              <button className="btn btn-primary btn-sm" onClick={openAdd}>
                <Icons.UserPlus /> Tambah Member
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { id: "ALL", label: "Total Member", val: loyalties.length, color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
            { id: "ACTIVE", label: "Aktif", val: loyalties.filter(c => c.is_active).length, color: "#34d399", bg: "rgba(52,211,153,0.12)" },
            { id: "INACTIVE", label: "Non-aktif", val: loyalties.filter(c => !c.is_active).length, color: "#f87171", bg: "rgba(239,68,68,0.12)" },
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
              placeholder="Cari nama, HP, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
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
            <div style={{ padding: 24 }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8, borderRadius: 8 }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                {search ? "Tidak ada member yang cocok" : "Belum ada member"}
              </p>
              <p style={{ fontSize: 13 }}>
                {search ? "Coba kata kunci lain" : "Klik \"Tambah Member\" untuk mulai mengisi logbook"}
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: "center", color: "var(--text-subtle)" }}>#</th>
                    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("nama")}>Nama <SortIcon sortConfig={sortConfig} columnKey="nama" /></th>
                    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("no_hp")}>No HP <SortIcon sortConfig={sortConfig} columnKey="no_hp" /></th>
                    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("email")}>Email <SortIcon sortConfig={sortConfig} columnKey="email" /></th>
                    <th style={{ textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("txCount")}>Total Transaksi <SortIcon sortConfig={sortConfig} columnKey="txCount" /></th>
                    <th style={{ width: 80, cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("is_active")}>Status <SortIcon sortConfig={sortConfig} columnKey="is_active" /></th>
                    <th style={{ width: 140, textAlign: "center" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.paginatedItems.map((c, idx) => {
                    const txCount = c.txCount;
                    return (
                      <tr key={c.id}>
                        <td style={{ textAlign: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-subtle)", background: "var(--bg-card-2)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 7px" }}>
                            {pagination.startIndex + idx}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {/* Avatar initials */}
                            <div style={{
                              width: 32, height: 32, borderRadius: "50%",
                              background: `hsl(${(c.id * 47) % 360}, 60%, 20%)`,
                              border: `1px solid hsl(${(c.id * 47) % 360}, 60%, 40%)`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12, fontWeight: 700, flexShrink: 0,
                              color: `hsl(${(c.id * 47) % 360}, 80%, 70%)`,
                            }}>
                              {c.nama.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{c.nama}</p>
                              {c.catatan && (
                                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }} title={c.catatan}>
                                  {c.catatan.length > 40 ? c.catatan.slice(0, 40) + "…" : c.catatan}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          {c.no_hp ? (
                            <a href={`https://wa.me/${c.no_hp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer"
                              style={{ color: "#34d399", fontSize: 13, display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
                              <Icons.Whatsapp /> {c.no_hp}
                            </a>
                          ) : <span style={{ color: "var(--text-subtle)" }}>—</span>}
                        </td>
                        <td>
                          {c.email ? (
                            <a href={`mailto:${c.email}`} style={{ color: "#38bdf8", fontSize: 13, textDecoration: "none" }}>
                              {c.email}
                            </a>
                          ) : <span style={{ color: "var(--text-subtle)" }}>—</span>}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className="badge" style={{ background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}>
                            {txCount} Transaksi
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${c.is_active ? "badge-active" : "badge-closed"}`}>
                            {c.is_active ? "Aktif" : "Nonaktif"}
                          </span>
                        </td>
                        {(canUpdate || canDelete) && (
                          <td>
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              <button className="btn btn-secondary btn-sm" title="Lihat Riwayat" onClick={() => onNavigate("invoice-list", c.nama)}>
                                <Icons.FileText /> Lihat Riwayat
                              </button>
                              {canUpdate && (
                                <button className="btn btn-secondary btn-sm btn-icon" title="Edit" onClick={() => openEdit(c)}>
                                  <Icons.Edit />
                                </button>
                              )}
                              {canDelete && (
                                <button className="btn btn-danger btn-sm btn-icon" title="Hapus" onClick={() => setDeleteTarget(c)}>
                                  <Icons.Trash />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <TablePaginationBottom
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            onPageChange={pagination.handlePageChange}
          />
        </div>

        {/* Modal Form */}
        {showModal && (
          <Modal
            title={editing ? `Edit Member — ${editing.nama}` : "Tambah Member Baru"}
            onClose={() => { setShowModal(false); setEditing(null); }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Nama Lengkap" required>
                <input
                  className="input"
                  placeholder="Contoh: Budi Santoso"
                  value={form.nama}
                  onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
                  autoFocus
                />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="No HP">
                  <input
                    className="input"
                    placeholder="08xx..."
                    value={form.no_hp}
                    onChange={e => setForm(f => ({ ...f, no_hp: e.target.value }))}
                  />
                </Field>
                <Field label="Email">
                  <input
                    className="input"
                    type="email"
                    placeholder="email@example.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </Field>
              </div>

              <Field label="Alamat">
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Alamat lengkap customer..."
                  value={form.alamat}
                  onChange={e => setForm(f => ({ ...f, alamat: e.target.value }))}
                />
              </Field>

              <Field label="Catatan">
                <input
                  className="input"
                  placeholder="Preferensi, catatan khusus, dsb..."
                  value={form.catatan}
                  onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))}
                />
              </Field>

              <Field label="Status">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    className={`toggle ${form.is_active ? "on" : ""}`}
                    onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  />
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {form.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
              </Field>

              <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={save}
                  disabled={saving || !form.nama.trim()}
                >
                  <Icons.Save />
                  {saving ? "Menyimpan..." : editing ? "Perbarui" : "Simpan Customer"}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => { setShowModal(false); setEditing(null); }}
                >
                  Batal
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>

      {/* ── Delete Confirmation Modal ── rendered outside animate-in to avoid transform clipping */}
      {deleteTarget && (
        <div
          className="modal-overlay"
          style={{ alignItems: "center" }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 16,
              width: "100%",
              maxWidth: 420,
              padding: 24,
              boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
              animation: "fadeSlideUp 0.2s ease",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Top row: icon + title + close */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20,
                }}>🗑️</div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>Hapus Customer</p>
                  <p style={{ fontSize: 12, color: "#f87171", marginTop: 2 }}>Tindakan ini tidak bisa dibatalkan</p>
                </div>
              </div>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setDeleteTarget(null)} style={{ flexShrink: 0 }}>
                <Icons.X />
              </button>
            </div>

            {/* Customer preview card */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: 10,
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.2)",
              marginBottom: 14,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                background: `hsl(${(deleteTarget.id * 47) % 360}, 60%, 20%)`,
                border: `1px solid hsl(${(deleteTarget.id * 47) % 360}, 60%, 40%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 700,
                color: `hsl(${(deleteTarget.id * 47) % 360}, 80%, 70%)`,
              }}>
                {deleteTarget.nama.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{deleteTarget.nama}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {[deleteTarget.no_hp, deleteTarget.email].filter(Boolean).join(" · ") || "Tidak ada kontak"}
                </p>
              </div>
            </div>

            {/* Warning text */}
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.6 }}>
              Apakah kamu yakin ingin menghapus{" "}
              <strong style={{ color: "var(--text-primary)" }}>{deleteTarget.nama}</strong>?
              {" "}Data yang sudah dihapus tidak dapat dikembalikan.
            </p>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-danger"
                style={{ flex: 1, justifyContent: "center", padding: "10px" }}
                onClick={del}
                disabled={deleting}
              >
                <Icons.Trash />
                {deleting ? "Menghapus..." : "Ya, Hapus Customer"}
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: "10px 18px" }}
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
