"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import type { FinancialTransaction } from "@/lib/supabase";
import { Icons, fmtRp } from "./ui";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Ags", "Sep", "Okt", "Nov", "Des",
];

type ChartEntry = {
  label: string;
  total: number;
  count: number;
  sortKey: number; // month (1-12) or year as number
};

function fmtDate(d: string) {
  if (!d) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, tipe }: any) {
  if (!active || !payload?.length) return null;
  const color = tipe === "PEMASUKAN" ? "#10b981" : "#ef4444";
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border-2)",
      borderRadius: 12, padding: "12px 16px", boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
      minWidth: 160,
    }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 800, color }}>{fmtRp(payload[0]?.value ?? 0)}</p>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{payload[0]?.payload?.count ?? 0} transaksi</p>
    </div>
  );
}

export default function FinancialReportPage() {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Controls
  const [activeTipe, setActiveTipe] = useState<"PEMASUKAN" | "PENGELUARAN">("PEMASUKAN");
  const [viewMode, setViewMode] = useState<"MONTH" | "YEAR">("MONTH");
  const [filterTahun, setFilterTahun] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/financial-transactions");
    if (res.ok) setTransactions(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derive years ──
  const years = useMemo(() => {
    const ys = new Set(transactions.map(t => t.tanggal?.slice(0, 4)).filter(Boolean));
    return [...ys].sort().reverse();
  }, [transactions]);

  // Default filter year to latest
  useEffect(() => {
    if (years.length > 0 && !filterTahun) setFilterTahun(years[0]);
  }, [years, filterTahun]);

  // ── Filter by tipe + year ──
  const filtered = useMemo(() => transactions.filter(t => {
    if (t.tipe !== activeTipe) return false;
    if (filterTahun && t.tanggal?.slice(0, 4) !== filterTahun) return false;
    return true;
  }), [transactions, activeTipe, filterTahun]);

  const totalNominal = useMemo(() => filtered.reduce((s, t) => s + Number(t.nominal), 0), [filtered]);
  const totalAll = useMemo(() => transactions.filter(t => t.tipe === activeTipe).reduce((s, t) => s + Number(t.nominal), 0), [transactions, activeTipe]);

  // ── Aggregate for chart ──
  const chartData = useMemo((): ChartEntry[] => {
    if (viewMode === "MONTH") {
      // Per month in the selected year
      const map: Record<string, ChartEntry> = {};
      for (let m = 1; m <= 12; m++) {
        const key = String(m).padStart(2, "0");
        map[key] = { label: MONTH_NAMES[m - 1], total: 0, count: 0, sortKey: m };
      }
      filtered.forEach(t => {
        const m = t.tanggal?.slice(5, 7);
        if (m && map[m]) { map[m].total += Number(t.nominal); map[m].count += 1; }
      });
      return Object.values(map).sort((a, b) => a.sortKey - b.sortKey);
    } else {
      // Per year across all data
      const tx = transactions.filter(t => t.tipe === activeTipe);
      const map: Record<string, ChartEntry> = {};
      tx.forEach(t => {
        const y = t.tanggal?.slice(0, 4);
        if (!y) return;
        if (!map[y]) map[y] = { label: y, total: 0, count: 0, sortKey: Number(y) };
        map[y].total += Number(t.nominal);
        map[y].count += 1;
      });
      return Object.values(map).sort((a, b) => a.sortKey - b.sortKey);
    }
  }, [filtered, transactions, activeTipe, viewMode]);


  const barColor = activeTipe === "PEMASUKAN" ? "#10b981" : "#ef4444";

  // ── Sorted transaction list ──
  const sortedTx = useMemo(
    () => [...filtered].sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
    [filtered]
  );

  return (
    <div className="animate-in">
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800 }} className="gradient-text">Rekap Finansial</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Analitik cashflow & grafik perkembangan keuangan</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}><Icons.Refresh /> Refresh</button>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ── Toggle Pemasukan / Pengeluaran ── */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ display: "inline-flex", background: "var(--bg-card-2)", padding: 6, borderRadius: 14, border: "1px solid var(--border)", gap: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
              {(["PEMASUKAN", "PENGELUARAN"] as const).map(t => (
                <button key={t} onClick={() => setActiveTipe(t)}
                  style={{
                    padding: "11px 36px", borderRadius: 10, fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer",
                    background: activeTipe === t
                      ? t === "PEMASUKAN"
                        ? "linear-gradient(135deg,rgba(16,185,129,0.25),rgba(52,211,153,0.15))"
                        : "linear-gradient(135deg,rgba(239,68,68,0.22),rgba(248,113,113,0.14))"
                      : "transparent",
                    color: activeTipe === t
                      ? t === "PEMASUKAN" ? "#10b981" : "#ef4444"
                      : "var(--text-muted)",
                    transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
                    boxShadow: activeTipe === t
                      ? `0 4px 14px ${t === "PEMASUKAN" ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.2)"}`
                      : "none",
                    transform: activeTipe === t ? "scale(1.02)" : "scale(1)",
                  }}>
                  {t === "PEMASUKAN" ? "💰 Pemasukan" : "💸 Pengeluaran"}
                </button>
              ))}
            </div>
          </div>

          {/* ── Controls: Per Bulan / Per Tahun + Year filter ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            {/* Period toggle */}
            <div style={{ display: "inline-flex", background: "var(--bg-card-2)", padding: 4, borderRadius: 10, border: "1px solid var(--border)", gap: 3 }}>
              {(["MONTH", "YEAR"] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)}
                  style={{
                    padding: "8px 22px", borderRadius: 7, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
                    background: viewMode === m ? "rgba(56,189,248,0.18)" : "transparent",
                    color: viewMode === m ? "#38bdf8" : "var(--text-muted)",
                    transition: "all 0.2s",
                  }}>
                  {m === "MONTH" ? "Per Bulan" : "Per Tahun"}
                </button>
              ))}
            </div>

            {/* Year selector (only shown in MONTH mode) */}
            {viewMode === "MONTH" && years.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Tahun:</span>
                <div style={{ display: "inline-flex", background: "var(--bg-card-2)", padding: 3, borderRadius: 8, border: "1px solid var(--border)", gap: 2 }}>
                  {years.map(y => (
                    <button key={y} onClick={() => setFilterTahun(y)}
                      style={{
                        padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
                        background: filterTahun === y ? "rgba(56,189,248,0.18)" : "transparent",
                        color: filterTahun === y ? "#38bdf8" : "var(--text-muted)",
                        transition: "all 0.2s",
                      }}>
                      {y}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Summary Card ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <div className="card" style={{
              padding: "22px 24px",
              borderLeft: `4px solid ${barColor}`,
              background: `linear-gradient(135deg,${barColor}0d,transparent)`,
              display: "flex", alignItems: "center", gap: 16,
            }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: `${barColor}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>
                {activeTipe === "PEMASUKAN" ? "💰" : "💸"}
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Total {activeTipe === "PEMASUKAN" ? "Pemasukan" : "Pengeluaran"}{viewMode === "MONTH" && filterTahun ? ` ${filterTahun}` : ""}
                </p>
                <p style={{ fontSize: 24, fontWeight: 800, color: barColor, marginTop: 4 }}>{fmtRp(totalNominal)}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{filtered.length} transaksi</p>
              </div>
            </div>

            {viewMode === "MONTH" && filterTahun && (
              <div className="card" style={{ padding: "22px 24px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(56,189,248,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>📊</div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Total {activeTipe === "PEMASUKAN" ? "Pemasukan" : "Pengeluaran"} Semua Waktu
                  </p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: "#38bdf8", marginTop: 4 }}>{fmtRp(totalAll)}</p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {transactions.filter(t => t.tipe === activeTipe).length} total transaksi
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Bar Chart ── */}
          <div className="card" style={{ padding: "24px 20px" }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", marginBottom: 6 }}>
              Grafik {activeTipe === "PEMASUKAN" ? "Pemasukan" : "Pengeluaran"} {viewMode === "MONTH" ? `Bulanan ${filterTahun}` : "Tahunan"}
            </h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
              {viewMode === "MONTH" ? `Distribusi per bulan tahun ${filterTahun}` : "Perbandingan antar tahun"}
            </p>

            {chartData.every(d => d.total === 0) ? (
              <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 48, marginBottom: 10 }}>📉</div>
                <p style={{ fontWeight: 600 }}>Tidak ada data untuk periode ini</p>
              </div>
            ) : (
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 600 }} dy={8} />
                    <YAxis axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                      tickFormatter={v => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)}
                      width={60} />
                    <Tooltip content={<CustomTooltip tipe={activeTipe} />} cursor={{ fill: "var(--bg-hover)", radius: 8 }} />
                    <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={60}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.total > 0 ? barColor : "var(--border)"}
                          opacity={entry.total > 0 ? 1 : 0.3}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Per-category breakdown ── */}
          {filtered.length > 0 && (() => {
            const catMap: Record<string, { nama: string; warna: string; total: number; count: number }> = {};
            filtered.forEach(t => {
              const key = t.kategori_id ? String(t.kategori_id) : "lainnya";
              const nama = t.kategori?.nama ?? "Tanpa Kategori";
              const warna = t.kategori?.warna ?? "#6b7280";
              if (!catMap[key]) catMap[key] = { nama, warna, total: 0, count: 0 };
              catMap[key].total += Number(t.nominal);
              catMap[key].count += 1;
            });
            const catList = Object.values(catMap).sort((a, b) => b.total - a.total);
            const grandTotal = catList.reduce((s, c) => s + c.total, 0);
            return (
              <div className="card" style={{ padding: "22px 24px" }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", marginBottom: 16 }}>
                  Rincian per Kategori
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {catList.map((c, i) => {
                    const pct = grandTotal > 0 ? (c.total / grandTotal) * 100 : 0;
                    return (
                      <div key={i}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.warna, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.nama}</span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>({c.count} transaksi)</span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: barColor }}>{fmtRp(c.total)}</span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div style={{ height: 6, borderRadius: 4, background: "var(--bg-card-2)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: c.warna, borderRadius: 4, transition: "width 0.6s ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── Transaction List ── */}
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", marginBottom: 14, paddingLeft: 2 }}>
              Semua Transaksi {activeTipe === "PEMASUKAN" ? "Pemasukan" : "Pengeluaran"}
              {viewMode === "MONTH" && filterTahun ? ` — ${filterTahun}` : ""}
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", marginLeft: 8 }}>({sortedTx.length} data)</span>
            </h3>

            {sortedTx.length === 0 ? (
              <div className="card" style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
                <p style={{ fontWeight: 600 }}>Belum ada data transaksi</p>
              </div>
            ) : (
              <div className="card" style={{ overflow: "hidden" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Kategori</th>
                      <th>Detail</th>
                      <th>Nominal</th>
                      <th>Deskripsi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTx.map(tx => (
                      <tr key={tx.id}>
                        <td style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtDate(tx.tanggal)}</td>
                        <td>
                          {tx.kategori ? (
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                              background: `${tx.kategori.warna}22`,
                              border: `1px solid ${tx.kategori.warna}55`,
                              color: tx.kategori.warna,
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: tx.kategori.warna }} />
                              {tx.kategori.nama}
                            </span>
                          ) : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ fontSize: 13, color: "var(--text-primary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tx.detail ?? "—"}
                        </td>
                        <td style={{ fontWeight: 700, color: barColor, whiteSpace: "nowrap" }}>
                          {activeTipe === "PEMASUKAN" ? "+" : "−"} {fmtRp(Number(tx.nominal))}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tx.deskripsi ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
