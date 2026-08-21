"use client";
import { useState, useCallback, useEffect } from "react";
import type { Invoice } from "@/lib/supabase";
import { Icons, fmtRp } from "./ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type Props = {
  onNavigate: (page: any, data?: unknown) => void;
};

type SummaryData = {
  key: string;     
  year: number;
  month: number;
  label: string;
  transactions: number;
  revenue: number;
  unpaid: number;
};

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export default function MonthlyReportPage({ onNavigate }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"MONTH" | "YEAR">("MONTH");

  const load = useCallback(async () => {
    setLoading(true);
    const invRes = await fetch("/api/invoices");
    if (invRes.ok) {
      setInvoices(await invRes.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Global summaries
  const activeInvoices = invoices.filter(i => i.status_pembayaran !== "CANCELLED");
  const totalTransactions = activeInvoices.length;
  const totalRevenue = activeInvoices.reduce((sum, i) => {
    if (i.status_pembayaran === "PAID") return sum + Number(i.grand_total);
    if (i.status_pembayaran === "DP") return sum + (Number(i.grand_total) - Number(i.sisa_tagihan));
    return sum;
  }, 0);
  const totalUnpaid = activeInvoices
    .filter(i => i.status_pembayaran === "UNPAID" || i.status_pembayaran === "DP")
    .reduce((sum, i) => sum + Number(i.sisa_tagihan), 0);

  // Aggregate data by month or year
  const grouped = activeInvoices.reduce((acc, inv) => {
    const d = new Date(inv.invoice_date);
    const y = d.getFullYear();
    const m = d.getMonth() + 1; // 1-12

    const isYearMode = viewMode === "YEAR";
    const key = isYearMode ? `${y}` : `${y}-${m.toString().padStart(2, '0')}`;
    const label = isYearMode ? `Tahun ${y}` : `${MONTH_NAMES[m - 1]} ${y}`;

    if (!acc[key]) {
      acc[key] = {
        key: key,
        year: y,
        month: isYearMode ? 0 : m,
        label: label,
        transactions: 0,
        revenue: 0,
        unpaid: 0,
      };
    }

    acc[key].transactions += 1;
    if (inv.status_pembayaran === "PAID") {
      // Full revenue
      acc[key].revenue += Number(inv.grand_total);
    } else if (inv.status_pembayaran === "DP") {
      // DP: revenue = amount already paid, unpaid = remaining sisa
      const sudahDibayar = Number(inv.grand_total) - Number(inv.sisa_tagihan);
      acc[key].revenue += sudahDibayar;
      acc[key].unpaid += Number(inv.sisa_tagihan);
    } else if (inv.status_pembayaran === "UNPAID") {
      acc[key].unpaid += Number(inv.sisa_tagihan);
    }

    return acc;
  }, {} as Record<string, SummaryData>);

  const chartData = Object.values(grouped).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  const reversedData = [...chartData].reverse(); // Show newest cards first

  const viewInvoices = (month: number, year: number) => {
    if (viewMode === "YEAR") {
      onNavigate("invoice-list", { filterYear: String(year) });
    } else {
      onNavigate("invoice-list", { filterMonth: String(month), filterYear: String(year) });
    }
  };

  return (
    <div className="animate-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>Laporan Penjualan</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Analitik dan statistik performa toko</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={load}><Icons.Refresh /> Refresh Data</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* Global Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
            <div className="card" style={{ padding: "20px 24px", borderLeft: "4px solid #38bdf8", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(56,189,248,0.15)", color: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                🛒
              </div>
              <div>
                <p style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Total Transaksi</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>{totalTransactions}</p>
              </div>
            </div>
            
            <div className="card" style={{ padding: "20px 24px", borderLeft: "4px solid #10b981", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(16,185,129,0.15)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                💰
              </div>
              <div>
                <p style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Total Pendapatan</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: "#10b981", marginTop: 4 }}>{fmtRp(totalRevenue)}</p>
              </div>
            </div>
            
            <div className="card" style={{ padding: "20px 24px", borderLeft: "4px solid #f59e0b", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(245,158,11,0.15)", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                ⏳
              </div>
              <div>
                <p style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Total Piutang (Sisa)</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b", marginTop: 4 }}>{fmtRp(totalUnpaid)}</p>
              </div>
            </div>
          </div>

          {/* Toggle Button */}
          <div style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}>
            <div style={{ display: "inline-flex", background: "var(--bg-card-2)", padding: 6, borderRadius: 12, border: "1px solid var(--border)", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
              <button 
                style={{ padding: "10px 32px", borderRadius: 8, fontSize: 13, fontWeight: 700, 
                        background: viewMode === "MONTH" ? "rgba(56,189,248,0.18)" : "transparent",
                        color: viewMode === "MONTH" ? "#38bdf8" : "var(--text-muted)", border: "none", cursor: "pointer", transition: "all 0.2s" }}
                onClick={() => setViewMode("MONTH")}
              >
                Data per Bulan
              </button>
              <button 
                style={{ padding: "10px 32px", borderRadius: 8, fontSize: 13, fontWeight: 700, 
                        background: viewMode === "YEAR" ? "rgba(56,189,248,0.18)" : "transparent",
                        color: viewMode === "YEAR" ? "#38bdf8" : "var(--text-muted)", border: "none", cursor: "pointer", transition: "all 0.2s" }}
                onClick={() => setViewMode("YEAR")}
              >
                Data per Tahun
              </button>
            </div>
          </div>
          
          {/* Chart Section */}
          {chartData.length > 0 && (
            <div className="card" style={{ padding: "24px 28px" }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 24, color: "var(--text-primary)" }}>
                Grafik {viewMode === "MONTH" ? "Bulanan" : "Tahunan"}
              </h3>
              <div style={{ width: "100%", height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 600 }} dy={12} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(val) => `Rp ${val / 1000000}M`} />
                    <Tooltip
                      formatter={(val: any) => fmtRp(Number(val))}
                      contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", boxShadow: "0 8px 30px rgba(0,0,0,0.15)", fontSize: 12, padding: "12px 16px" }}
                      itemStyle={{ padding: "2px 0" }}
                      cursor={{ fill: "var(--bg-hover)" }}
                    />
                    <Legend wrapperStyle={{ paddingTop: 20, fontSize: 12, fontWeight: 600 }} />
                    <Bar dataKey="revenue" name="Pendapatan (PAID)" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="unpaid" name="Belum Lunas" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Cards Section */}
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 16, color: "var(--text-primary)", paddingLeft: 4 }}>
              Rincian {viewMode === "MONTH" ? "Bulanan" : "Tahunan"}
            </h3>
            {reversedData.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)" }}>
                Belum ada data transaksi.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
                {reversedData.map((data) => (
                  <div key={data.key} className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, border: "1px solid var(--border)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed var(--border)", paddingBottom: 16 }}>
                      <h4 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{data.label}</h4>
                      <span className="badge" style={{ background: "rgba(56,189,248,0.15)", color: "#38bdf8", fontWeight: 800, padding: "6px 12px", fontSize: 12 }}>{data.transactions} Transaksi</span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg-card-2)", borderRadius: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600 }}>
                          <span>💰</span> Pendapatan Masuk
                        </div>
                        <span style={{ fontWeight: 800, color: "#10b981", fontSize: 15 }}>{fmtRp(data.revenue)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg-card-2)", borderRadius: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600 }}>
                          <span>⏳</span> Belum Lunas
                        </div>
                        <span style={{ fontWeight: 800, color: "#f59e0b", fontSize: 15 }}>{fmtRp(data.unpaid)}</span>
                      </div>
                    </div>

                    <button 
                      className="btn btn-primary" 
                      style={{ marginTop: 8, width: "100%", justifyContent: "center", padding: "12px 0", fontSize: 13, fontWeight: 700 }}
                      onClick={() => viewInvoices(data.month, data.year)}
                    >
                      <Icons.Search /> Lihat Invoice {data.label}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
