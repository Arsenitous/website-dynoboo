"use client";
import { useState, useCallback, useEffect } from "react";
import type { Item, ItemType } from "@/lib/supabase";
import { Icons, Modal, Field, CustomSelect, fmtRp, useToast, SortIcon, TablePaginationTop, TablePaginationBottom } from "./ui";
import { usePagination } from "@/lib/usePagination";
import { useSort } from "@/lib/useSort";
import { useAccess } from "./AccessContext";

export default function KatalogPage() {
  const hasAccess = useAccess();
  const canCreate = hasAccess("produk_ws", "create");
  const canUpdate = hasAccess("produk_ws", "update");
  const canDelete = hasAccess("produk_ws", "delete");
  const canManageTypes = canCreate || canDelete;
  const { showToast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const [addStockTarget, setAddStockTarget] = useState<Item | null>(null);
  const [addStockQty, setAddStockQty] = useState("");
  const [savingStock, setSavingStock] = useState(false);

  const [addingTypeModal, setAddingTypeModal] = useState(false);
  const [newTypeForm, setNewTypeForm] = useState({ nama: "", icon: "📦" });
  const [deletingItemType, setDeletingItemType] = useState<{ id: number; nama: string } | null>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);

  const emptyForm = { item_type_id: "", nama: "", deskripsi: "", harga_normal: "", harga_promo: "", satuan: "Pcs", is_active: true, qty_available: "0" };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const [itemsRes, typesRes] = await Promise.all([fetch("/api/items"), fetch("/api/item-types")]);
    setItems(await itemsRes.json());
    setItemTypes(await typesRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(emptyForm); setAdding(true); setEditing(null); };
  const openEdit = (item: Item) => {
    setForm({
      item_type_id: String(item.item_type_id ?? ""),
      nama: item.nama,
      deskripsi: item.deskripsi ?? "",
      harga_normal: String(item.harga_normal),
      harga_promo: String(item.harga_promo ?? ""),
      satuan: item.satuan,
      is_active: item.is_active,
      qty_available: String(Array.isArray(item.stock) ? item.stock[0]?.qty_available ?? 0 : item.stock?.qty_available ?? 0),
    });
    setEditing(item); setAdding(false);
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      item_type_id: form.item_type_id ? Number(form.item_type_id) : null,
      nama: form.nama,
      deskripsi: form.deskripsi || null,
      harga_normal: Number(form.harga_normal),
      harga_promo: form.harga_promo ? Number(form.harga_promo) : null,
      satuan: form.satuan,
      is_active: form.is_active,
      qty_available: Number(form.qty_available),
    };
    if (editing) {
      await fetch(`/api/items/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      showToast("Item katalog berhasil diperbarui!");
    } else {
      await fetch("/api/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      showToast("Item katalog berhasil ditambahkan!");
    }
    setSaving(false); setAdding(false); setEditing(null); load();
  };

  const saveNewType = async () => {
    if (!newTypeForm.nama) return;
    setSaving(true);
    const r = await fetch("/api/item-types", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTypeForm)
    });
    setSaving(false);
    if (r.ok) {
      const newType = await r.json();
      setItemTypes(prev => [...prev, newType]);
      setForm(f => ({ ...f, item_type_id: String(newType.id) }));
      setNewTypeForm({ nama: "", icon: "📦" });
      showToast(`Tipe item "${newType.nama}" berhasil ditambahkan!`);
    } else {
      showToast("Gagal menambahkan tipe item. Mungkin nama tersebut sudah ada?", "err");
    }
  };

  const deleteType = async () => {
    if (!deletingItemType) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/item-types/${deletingItemType.id}`, { method: "DELETE" });
      if (res.ok) {
        setItemTypes(prev => prev.filter(t => t.id !== deletingItemType.id));
        if (form.item_type_id === String(deletingItemType.id)) {
          setForm(f => ({ ...f, item_type_id: "" }));
        }
        showToast(`Tipe item "${deletingItemType.nama}" berhasil dihapus!`);
        setDeletingItemType(null);
        load();
      } else {
        const err = await res.json();
        showToast(err.error || "Gagal menghapus tipe item.", "err");
      }
    } catch {
      showToast("Terjadi kesalahan saat menghapus tipe item.", "err");
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!deletingItem) return;
    await fetch(`/api/items/${deletingItem.id}`, { method: "DELETE" });
    showToast("Item katalog berhasil dihapus!");
    setDeletingItem(null);
    load();
  };

  const typeOptions = [{ value: "", label: "Semua Tipe" }, ...itemTypes.map(t => ({ value: String(t.id), label: `${t.icon} ${t.nama}` }))];
  const satOptions = [{ value: "Pcs", label: "Pcs" }, { value: "Slot", label: "Slot" }, { value: "Set", label: "Set" }, { value: "Paket", label: "Paket" }];

  const filtered = items.filter(item => {
    const mSearch = item.nama.toLowerCase().includes(search.toLowerCase());
    const mType = filterType ? item.item_type_id === Number(filterType) : true;
    const mStatus = filterStatus === "ALL" ? true : filterStatus === "ACTIVE" ? item.is_active : !item.is_active;
    return mSearch && mType && mStatus;
  });

  const { sortedItems: sortedFiltered, handleSort, sortConfig } = useSort(filtered);

  const pagination = usePagination(sortedFiltered);

  const saveQuickStock = async () => {
    if (!addStockTarget) return;
    setSavingStock(true);
    try {
      const res = await fetch(`/api/stocks/${addStockTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "adjust", adjust_by: Number(addStockQty) }),
      });
      if (res.ok) {
        showToast(`Stok "${addStockTarget.nama}" berhasil ditambah!`);
        setAddStockTarget(null);
        load();
      } else {
        const d = await res.json();
        showToast(d.error ?? "Gagal tambah stok", "err");
      }
    } catch {
      showToast("Terjadi kesalahan sistem", "err");
    } finally {
      setSavingStock(false);
    }
  };

  return (
    <div className="animate-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Katalog Produk</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{items.length} item terdaftar</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canManageTypes && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setNewTypeForm({ nama: "", icon: "📦" }); setAddingTypeModal(true); }}><Icons.Layers /> Kelola Tipe</button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={load}><Icons.Refresh /> Refresh</button>
          {canCreate && (
            <button className="btn btn-primary btn-sm" onClick={openAdd}><Icons.Plus /> Tambah Item</button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { id: "ALL", label: "Total Item", val: items.length, color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
          { id: "ACTIVE", label: "Aktif", val: items.filter(c => c.is_active).length, color: "#34d399", bg: "rgba(52,211,153,0.12)" },
          { id: "INACTIVE", label: "Non-aktif", val: items.filter(c => !c.is_active).length, color: "#f87171", bg: "rgba(239,68,68,0.12)" },
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
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}><Icons.Search /></span>
          <input className="input" style={{ paddingLeft: 36, width: "100%", height: 38 }} placeholder="Cari nama produk..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ width: 200 }}>
          <CustomSelect value={filterType} onChange={setFilterType} options={typeOptions} />
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
        {loading ? (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 56 }} />)}
          </div>
        ) : (
          <table className="data-table">
            <thead><tr>
              <th style={{ width: 44, textAlign: "center", color: "var(--text-subtle)" }}>#</th>
              <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("nama")}>Nama Item <SortIcon sortConfig={sortConfig} columnKey="nama" /></th>
              <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("item_type_id")}>Tipe <SortIcon sortConfig={sortConfig} columnKey="item_type_id" /></th>
              <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("harga_normal")}>Harga Normal <SortIcon sortConfig={sortConfig} columnKey="harga_normal" /></th>
              <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("harga_promo")}>Harga Promo <SortIcon sortConfig={sortConfig} columnKey="harga_promo" /></th>
              <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("is_active")}>Status <SortIcon sortConfig={sortConfig} columnKey="is_active" /></th>
              {(canUpdate || canDelete) && <th style={{ width: 90 }}>Aksi</th>}
            </tr></thead>
            <tbody>
              {pagination.paginatedItems.map((item, idx) => (
                <tr key={item.id}>
                  <td style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-subtle)", background: "var(--bg-card-2)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 7px" }}>
                      {pagination.startIndex + idx}
                    </span>
                  </td>
                  <td>
                    <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.nama}</p>
                    {item.deskripsi && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{item.deskripsi}</p>}
                    <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>Satuan: {item.satuan}</p>
                  </td>
                  <td><span style={{ fontSize: 12 }}>{item.item_type ? `${item.item_type.icon} ${item.item_type.nama}` : "—"}</span></td>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{fmtRp(item.harga_normal)}</td>
                  <td style={{ color: "#34d399", fontWeight: 600 }}>{item.harga_promo ? fmtRp(item.harga_promo) : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td><span className={`badge ${item.is_active ? "badge-active" : "badge-closed"}`}>{item.is_active ? "Aktif" : "Nonaktif"}</span></td>
                  {(canUpdate || canDelete) && (
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {canUpdate && (
                          <button className="btn btn-primary btn-sm btn-icon" title="Tambah Stok" onClick={() => { setAddStockTarget(item); setAddStockQty("0"); }}>
                            <Icons.Plus />
                          </button>
                        )}
                        {canUpdate && <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(item)}><Icons.Edit /></button>}
                        {canDelete && <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeletingItem(item)}><Icons.Trash /></button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>📦 Belum ada item di katalog</td></tr>}
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

      {(adding || !!editing) && (
        <Modal title={editing ? `Edit: ${editing.nama}` : "Tambah Item Katalog"} onClose={() => { setAdding(false); setEditing(null); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Tipe Item" required>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <CustomSelect value={form.item_type_id} onChange={v => setForm({ ...form, item_type_id: v })} options={[{ value: "", label: "— Pilih Tipe —" }, ...itemTypes.map(t => ({ value: String(t.id), label: `${t.icon} ${t.nama}` }))]} />
                </div>
                <button className="btn btn-secondary" style={{ padding: "0 14px" }} onClick={() => { setNewTypeForm({ nama: "", icon: "📦" }); setAddingTypeModal(true); }} title="Kelola Tipe Item">
                  <Icons.Plus />
                </button>
              </div>
            </Field>
            <Field label="Nama Item" required><input className="input" placeholder="Workshop Animal Pot, Boneka Beruang..." value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} /></Field>
            <Field label="Deskripsi"><textarea className="input" rows={2} placeholder="Deskripsi singkat produk..." value={form.deskripsi} onChange={e => setForm({ ...form, deskripsi: e.target.value })} /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Harga Normal" required><input className="input" type="number" placeholder="100000" value={form.harga_normal} onChange={e => setForm({ ...form, harga_normal: e.target.value })} /></Field>
              <Field label="Harga Promo"><input className="input" type="number" placeholder="90000" value={form.harga_promo} onChange={e => setForm({ ...form, harga_promo: e.target.value })} /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Satuan"><CustomSelect value={form.satuan} onChange={v => setForm({ ...form, satuan: v })} options={satOptions} /></Field>
              <Field label="Stok Awal"><input className="input" type="number" placeholder="0" value={form.qty_available} onChange={e => setForm({ ...form, qty_available: e.target.value })} /></Field>
            </div>
            <Field label="Status">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className={`toggle ${form.is_active ? "on" : ""}`} onClick={() => setForm({ ...form, is_active: !form.is_active })} />
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{form.is_active ? "Aktif (tampil & bisa dijual)" : "Nonaktif (tersembunyi)"}</span>
              </div>
            </Field>
            <div style={{ display: "flex", gap: 8, paddingTop: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={saving || !form.nama || !form.harga_normal || !form.item_type_id}>
                <Icons.Save /> {saving ? "Menyimpan..." : "Simpan"}
              </button>
              <button className="btn btn-secondary" onClick={() => { setAdding(false); setEditing(null); }}>Batal</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Quick Add Stock Modal */}
      {addStockTarget && (
        <Modal title={`Tambah Stok — ${addStockTarget.nama}`} onClose={() => setAddStockTarget(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Jumlah Tambah">
              <input className="input" type="number" placeholder="Contoh: 10" value={addStockQty} onChange={e => setAddStockQty(e.target.value)} autoFocus />
            </Field>
            <div style={{ display: "flex", gap: 8, paddingTop: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveQuickStock} disabled={savingStock || !addStockQty || Number(addStockQty) <= 0}>
                <Icons.Save /> {savingStock ? "Menyimpan..." : "Tambah"}
              </button>
              <button className="btn btn-secondary" onClick={() => setAddStockTarget(null)}>Batal</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Kelola & Tambah Tipe Item */}
      {addingTypeModal && (
        <Modal title="Kelola Tipe Item" onClose={() => setAddingTypeModal(false)} wide={false}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, display: "block" }}>
                Tambah Tipe Item Baru
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Field label="Nama Tipe" required>
                  <input className="input" placeholder="Contoh: Merchandise, Workshop, Tiket..." value={newTypeForm.nama} onChange={e => setNewTypeForm({ ...newTypeForm, nama: e.target.value })} autoFocus />
                </Field>
                <Field label="Icon (Emoji)" required>
                  <input className="input" placeholder="📦" value={newTypeForm.icon} onChange={e => setNewTypeForm({ ...newTypeForm, icon: e.target.value })} />
                </Field>
                <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 4 }} onClick={saveNewType} disabled={saving || !newTypeForm.nama}>
                  <Icons.Plus /> {saving ? "Menyimpan..." : "Tambah Tipe Baru"}
                </button>
              </div>
            </div>

            <div style={{ height: 1, background: "var(--border)" }} />

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10, display: "block" }}>
                Daftar Tipe Item ({itemTypes.length})
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                {itemTypes.map(t => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-input)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{t.icon || "📦"}</span>
                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{t.nama}</span>
                    </div>
                    {canDelete && (
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeletingItemType({ id: t.id, nama: t.nama })} disabled={saving} title={`Hapus ${t.nama}`}>
                        <Icons.Trash />
                      </button>
                    )}
                  </div>
                ))}
                {itemTypes.length === 0 && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 12 }}>Belum ada tipe item</p>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
              <button className="btn btn-secondary" onClick={() => setAddingTypeModal(false)}>Tutup</button>
            </div>
          </div>
        </Modal>
      )}
      {deletingItemType && (
        <Modal title="Hapus Tipe Item" onClose={() => setDeletingItemType(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>🗑️</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{deletingItemType.nama}</p>
                </div>
              </div>
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 13, color: "#f59e0b", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <span>Apakah Anda yakin ingin menghapus tipe item ini? Perhatian: Item yang terhubung ke tipe ini akan kehilangan kategori tipenya.</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-sm" style={{ flex: 1, justifyContent: "center", background: "linear-gradient(135deg,rgba(239,68,68,0.2),rgba(220,38,38,0.15))", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)", padding: "10px 0", fontWeight: 700 }} onClick={deleteType}>Ya, Hapus</button>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center", padding: "10px 0" }} onClick={() => setDeletingItemType(null)}>Batal</button>
            </div>
          </div>
        </Modal>
      )}

      {deletingItem && (
        <Modal title="Hapus Item Katalog" onClose={() => setDeletingItem(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>🗑️</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{deletingItem.nama}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{fmtRp(deletingItem.harga_normal)}</p>
                </div>
              </div>
            </div>
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 13, color: "#f59e0b", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <span>Anda yakin ingin menghapus item ini? Ini akan menghapus stok terkait juga secara permanen.</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-sm" style={{ flex: 1, justifyContent: "center", background: "linear-gradient(135deg,rgba(239,68,68,0.2),rgba(220,38,38,0.15))", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)", padding: "10px 0", fontWeight: 700 }} onClick={del}>Ya, Hapus</button>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center", padding: "10px 0" }} onClick={() => setDeletingItem(null)}>Batal</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

