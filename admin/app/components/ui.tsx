"use client";
import { useRef, useEffect, useState, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { PAGE_SIZE_OPTIONS, PageSize } from "@/lib/usePagination";

// ─── Toast System ─────────────────────────────────────────────────────────────
type ToastType = "ok" | "err";
type ToastMsg = { id: number; msg: string; type: ToastType };
type ToastContextType = { showToast: (msg: string, type?: ToastType) => void };

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const showToast = (msg: string, type: ToastType = "ok") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 && createPortal(
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none"
        }}>
          {toasts.map(toast => (
            <div key={toast.id} style={{
              padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: toast.type === "ok" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
              border: `1px solid ${toast.type === "ok" ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
              color: toast.type === "ok" ? "#34d399" : "#f87171",
              backdropFilter: "blur(8px)",
              pointerEvents: "auto",
              animation: "toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1)",
              display: "flex", alignItems: "center", gap: 8
            }}>
              <span style={{ fontSize: 16 }}>{toast.type === "ok" ? "✓" : "⚠"}</span>
              {toast.msg}
            </div>
          ))}
          <style>{`
            @keyframes toastIn {
              from { opacity: 0; transform: translateX(30px); }
              to { opacity: 1; transform: translateX(0); }
            }
          `}</style>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// ─── Icons ────────────────────────────────────────────────────────────────────
export const Icons = {
  Dashboard: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  Brain: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>,
  Workshop: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  Orders: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  Chat: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Lock: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Package: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>,
  Layers: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>,
  BarChart: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>,
  Receipt: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8H8"/><path d="M16 12H8"/><path d="M12 16H8"/></svg>,
  Plus: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>,
  FileText: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>,
  Building: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>,
  Bot: () => <span style={{ fontSize: 16, display: "inline-flex", alignItems: "center", lineHeight: 1 }}>🦕</span>,
  Edit: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>,
  Trash: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Save: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  X: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>,
  Refresh: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  Sun: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>,
  Moon: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  Logout: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>,
  ChevDown: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>,
  Check: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Search: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>,
  Key: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  Eye: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  Whatsapp: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>,
  Mail: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  Printer: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect width="12" height="8" x="6" y="14" rx="1"/></svg>,
  CreditCard: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>,
  TrendingUp: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  AlertTriangle: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>,
  Send: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>,
  Book: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>,
  CheckCircle: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  Users: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  UserPlus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" x2="20" y1="8" y2="14"/><line x1="23" x2="17" y1="11" y2="11"/></svg>,
  UserCheck: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>,
};


// ─── Sort Icon ───────────────────────────────────────────────────────────────
export function SortIcon({ sortConfig, columnKey }: { sortConfig: { key: string; direction: "asc" | "desc" } | null, columnKey: string }) {
  if (sortConfig?.key !== columnKey) return <span style={{ opacity: 0.3, marginLeft: 4, fontSize: 10 }}>↕</span>;
  return <span style={{ marginLeft: 4, fontSize: 10 }}>{sortConfig.direction === "asc" ? "▲" : "▼"}</span>;
}

// ─── Custom Select ────────────────────────────────────────────────────────────
type SelectOption = { value: string; label: string; color?: string };
export function CustomSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: SelectOption[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="custom-select-wrapper">
      <div className={`custom-select-trigger ${open ? "open" : ""}`} onClick={() => setOpen(v => !v)}>
        <span style={{ color: selected?.color }}>{selected?.label ?? value}</span>
        <span style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", color: "var(--text-muted)" }}><Icons.ChevDown /></span>
      </div>
      {open && (
        <div className="custom-select-dropdown">
          {options.map(opt => (
            <div key={opt.value} className={`custom-select-option ${opt.value === value ? "selected" : ""}`} onClick={() => { onChange(opt.value); setOpen(false); }}>
              {opt.value === value ? <Icons.Check /> : <span style={{ width: 13 }} />}
              <span style={{ color: opt.color }}>{opt.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal (Portal — renders at document.body to escape all parent stacking contexts) ───
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        style={{ maxWidth: wide ? 820 : 600 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-box-header">
          <h3 style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>{title}</h3>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}><Icons.X /></button>
        </div>
        <div className="modal-box-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}


// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({ label, value, color, bg, icon, sub }: { label: string; value: string | number; color: string; bg: string; icon: React.ReactNode; sub?: string }) {
  return (
    <div className="stat-card animate-in">
      <div className="stat-icon" style={{ background: bg, boxShadow: `0 0 20px ${color}40` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{label}</p>
        {sub && <p style={{ fontSize: 11, color, marginTop: 2 }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Form Field ───────────────────────────────────────────────────────────────
export function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, letterSpacing: "0.03em" }}>
        {label} {required && <span style={{ color: "#f472b6" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
export function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    PAID: { cls: "badge-paid", label: "✓ PAID" },
    DP: { cls: "badge-dp", label: "◑ DP" },
    UNPAID: { cls: "badge-unpaid", label: "○ UNPAID" },
    CANCELLED: { cls: "badge-cancelled", label: "✕ CANCELLED" },
  };
  const { cls, label } = map[status] ?? { cls: "badge-closed", label: status };
  return <span className={`badge ${cls}`}>{label}</span>;
}

// ─── Currency Format ──────────────────────────────────────────────────────────
export function fmtRp(n: number | string) {
  return "Rp " + Number(n).toLocaleString("id-ID");
}


// ─── Table Pagination ─────────────────────────────────────────────────────────

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
};

/** Top bar: "Menampilkan X–Y dari Z" + page-size buttons */
export function TablePaginationTop({
  totalItems, startIndex, endIndex, pageSize, onPageSizeChange,
}: Pick<PaginationProps, "totalItems"|"startIndex"|"endIndex"|"pageSize"|"onPageSizeChange">) {
  if (totalItems === 0) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 16px", borderBottom: "1px solid var(--border)",
    }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Menampilkan{" "}
        <strong style={{ color: "var(--text-secondary)" }}>{startIndex}–{endIndex}</strong>{" "}
        dari{" "}
        <strong style={{ color: "var(--text-secondary)" }}>{totalItems}</strong> data
      </span>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>  Tampilkan</span>
      <div style={{ display: "flex", gap: 3 }}>
        {PAGE_SIZE_OPTIONS.map(size => (
          <button key={size} onClick={() => onPageSizeChange(size)} style={{
            padding: "3px 8px", fontSize: 11, fontWeight: 600, borderRadius: 6,
            border: `1px solid ${pageSize === size ? "var(--accent)" : "var(--border)"}`,
            background: pageSize === size ? "var(--accent)" : "transparent",
            color: pageSize === size ? "#fff" : "var(--text-muted)",
            cursor: "pointer", transition: "all 0.15s ease",
          }}>{size}</button>
        ))}
      </div>
    </div>
  );
}

/** Bottom bar: Prev · 1 2 3 · Next */
export function TablePaginationBottom({
  currentPage, totalPages, totalItems, onPageChange,
}: Pick<PaginationProps, "currentPage"|"totalPages"|"totalItems"|"onPageChange">) {
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  if (totalItems === 0 || totalPages <= 1) return null;

  const btnBase: React.CSSProperties = {
    padding: "4px 10px", fontSize: 12, fontWeight: 600, borderRadius: 6,
    border: "1px solid var(--border)", background: "transparent",
    cursor: "pointer", transition: "all 0.15s ease",
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 4, padding: "10px 16px", borderTop: "1px solid var(--border)",
    }}>
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}
        style={{ ...btnBase, color: currentPage === 1 ? "var(--text-muted)" : "var(--text-secondary)", opacity: currentPage === 1 ? 0.4 : 1, cursor: currentPage === 1 ? "not-allowed" : "pointer" }}>
        ‹ Prev
      </button>
      {getPageNumbers().map((page, idx) =>
        page === "..." ? (
          <span key={`e-${idx}`} style={{ padding: "4px 4px", fontSize: 12, color: "var(--text-muted)" }}>…</span>
        ) : (
          <button key={page} onClick={() => onPageChange(page as number)} style={{
            ...btnBase, minWidth: 32,
            border: `1px solid ${currentPage === page ? "var(--accent)" : "var(--border)"}`,
            background: currentPage === page ? "var(--accent)" : "transparent",
            color: currentPage === page ? "#fff" : "var(--text-secondary)",
          }}>{page}</button>
        )
      )}
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}
        style={{ ...btnBase, color: currentPage === totalPages ? "var(--text-muted)" : "var(--text-secondary)", opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? "not-allowed" : "pointer" }}>
        Next ›
      </button>
    </div>
  );
}

/** Combined (legacy kept for backward compat — not used after split) */
export function TablePagination(props: PaginationProps) {
  if (props.totalItems === 0) return null;
  return (
    <>
      <TablePaginationTop {...props} />
      <TablePaginationBottom {...props} />
    </>
  );
}

