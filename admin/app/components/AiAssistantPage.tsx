"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { Icons } from "./ui";

type Message = { role: "user" | "assistant"; content: string };

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
};

const SESSIONS_STORAGE_KEY = "dynoboo_ai_sessions";
const ACTIVE_SESSION_STORAGE_KEY = "dynoboo_ai_active_session_id";
const MAX_SESSIONS = 10; // Maksimal 10 topik percakapan disimpan
const MAX_MESSAGES_PER_SESSION = 25; // Maksimal 25 pesan per sesi (FIFO)
const MAX_CONTEXT_FOR_AI = 8; // Kirim maksimal 8 pesan terakhir ke Gemini (hemat token)
const EXPIRY_MS = 3 * 24 * 60 * 60 * 1000; // 3 hari otomatis hapus sesi lama

const DEFAULT_WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "Halo! Saya asisten pribadi DynoBoo 🦖✨\n\nSaya siap membantu kamu dengan:\n• Pengelolaan produk & stok\n• Pembuatan invoice & laporan\n• Strategi marketing & caption IG\n• Pertanyaan seputar bisnis\n\nAda yang bisa saya bantu hari ini?",
};

function createNewSession(): ChatSession {
  const now = Date.now();
  return {
    id: `sess_${now}_${Math.random().toString(36).substring(2, 6)}`,
    title: "Percakapan Baru",
    messages: [DEFAULT_WELCOME_MESSAGE],
    createdAt: now,
    updatedAt: now,
  };
}

function cleanExpiredSessions(sessions: ChatSession[]): ChatSession[] {
  const now = Date.now();
  return sessions.filter((s) => now - (s.updatedAt || s.createdAt) <= EXPIRY_MS);
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins}m lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}j lalu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Kemarin";
  return `${days} hari lalu`;
}

// Parser markdown ringan agar teks AI tampil rapi, bold berwarna kontras, dan bullet point indah
function FormattedMessage({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) {
    return <span style={{ whiteSpace: "pre-wrap" }}>{content}</span>;
  }

  const lines = content.split("\n");

  const parseInlineStyles = (text: string) => {
    // Parsing **bold text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} style={{ fontWeight: 700, color: "#38bdf8" }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Baris kosong antar paragraf
        if (!trimmed) {
          return <div key={idx} style={{ height: 4 }} />;
        }

        // Bullet point (* atau -)
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
          const bulletContent = trimmed.slice(2);
          return (
            <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 7, paddingLeft: 4, margin: "1px 0" }}>
              <span style={{ color: "#38bdf8", fontSize: 13, lineHeight: 1.4, flexShrink: 0 }}>•</span>
              <span style={{ flex: 1, lineHeight: 1.5 }}>{parseInlineStyles(bulletContent)}</span>
            </div>
          );
        }

        // Numbered list (1. , 2. )
        const numberMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numberMatch) {
          return (
            <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 6, paddingLeft: 4, margin: "1px 0" }}>
              <span style={{ color: "#38bdf8", fontWeight: 700, fontSize: 11, lineHeight: 1.5, flexShrink: 0 }}>
                {numberMatch[1]}.
              </span>
              <span style={{ flex: 1, lineHeight: 1.5 }}>{parseInlineStyles(numberMatch[2])}</span>
            </div>
          );
        }

        // Teks biasa
        return (
          <div key={idx} style={{ lineHeight: 1.5 }}>
            {parseInlineStyles(line)}
          </div>
        );
      })}
    </div>
  );
}

export default function AiAssistantPage({ isFloating = false }: { isFloating?: boolean }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Inisialisasi sessions dari localStorage & bersihkan yang > 3 hari
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
      let loadedSessions: ChatSession[] = [];

      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedSessions = cleanExpiredSessions(parsed);
        }
      }

      // Jika belum ada session sama sekali atau semua sudah expire
      if (loadedSessions.length === 0) {
        const initial = createNewSession();
        loadedSessions = [initial];
      }

      // Sort sesi dari yang paling baru diupdate
      loadedSessions.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));

      // Simpan kembali hasil pembersihan
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(loadedSessions));
      setSessions(loadedSessions);

      // Restore active session
      const savedActiveId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      const isExist = loadedSessions.some((s) => s.id === savedActiveId);
      const chosenId = isExist && savedActiveId ? savedActiveId : loadedSessions[0].id;
      setActiveSessionId(chosenId);
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, chosenId);
    } catch (err) {
      console.error("Gagal inisialisasi riwayat sesi:", err);
      const fallback = createNewSession();
      setSessions([fallback]);
      setActiveSessionId(fallback.id);
    }
  }, []);

  // Sesi aktif saat ini
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || sessions[0] || null;
  }, [sessions, activeSessionId]);

  const messages = activeSession ? activeSession.messages : [DEFAULT_WELCOME_MESSAGE];

  // Auto scroll saat pesan bertambah / loading
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Simpan seluruh sessions ke storage
  const persistSessions = (newSessions: ChatSession[], newActiveId?: string) => {
    try {
      // Batasi jumlah sesi tersimpan
      const cleaned = cleanExpiredSessions(newSessions).slice(0, MAX_SESSIONS);
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(cleaned));
      if (newActiveId) {
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, newActiveId);
      }
    } catch (err) {
      console.error("Gagal menyimpan riwayat sesi:", err);
    }
  };

  // Buat sesi percakapan baru
  const handleCreateNewChat = () => {
    // Jika sesi saat ini masih kosong (cuma pesan bot pembuka), cukup arahkan ke sesi tersebut
    if (activeSession && activeSession.messages.length <= 1) {
      setShowHistoryPanel(false);
      inputRef.current?.focus();
      return;
    }

    const newSess = createNewSession();
    const updated = [newSess, ...sessions].slice(0, MAX_SESSIONS);
    setSessions(updated);
    setActiveSessionId(newSess.id);
    persistSessions(updated, newSess.id);
    setShowHistoryPanel(false);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Switch ke sesi yang dipilih
  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, id);
    setShowHistoryPanel(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Hapus satu sesi tertentu
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirmId === id) {
      const remaining = sessions.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        const fresh = createNewSession();
        setSessions([fresh]);
        setActiveSessionId(fresh.id);
        persistSessions([fresh], fresh.id);
      } else {
        setSessions(remaining);
        if (activeSessionId === id) {
          setActiveSessionId(remaining[0].id);
          persistSessions(remaining, remaining[0].id);
        } else {
          persistSessions(remaining);
        }
      }
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(null), 3500);
    }
  };

  // Hapus semua sesi
  const handleClearAllSessions = () => {
    const fresh = createNewSession();
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
    persistSessions([fresh], fresh.id);
    setShowHistoryPanel(false);
  };

  // Kirim pesan ke Gemini
  const send = async () => {
    const text = input.trim();
    if (!text || loading || !activeSession) return;
    setInput("");

    const now = Date.now();
    const userMsg: Message = { role: "user", content: text };
    const currentMsgs = activeSession.messages;

    // Tentukan judul sesi otomatis dari pesan pertama jika masih judul default
    let newTitle = activeSession.title;
    if (newTitle === "Percakapan Baru") {
      newTitle = text.length > 28 ? `${text.slice(0, 28)}...` : text;
    }

    const updatedMessages: Message[] = [...currentMsgs, userMsg].slice(-MAX_MESSAGES_PER_SESSION);

    // Update state sesi aktif
    const updatedSessions = sessions.map((s) => {
      if (s.id === activeSession.id) {
        return {
          ...s,
          title: newTitle,
          messages: updatedMessages,
          updatedAt: now,
        };
      }
      return s;
    });

    // Pindahkan sesi yang baru diupdate ke posisi paling atas
    updatedSessions.sort((a, b) => (b.id === activeSession.id ? 1 : 0) - (a.id === activeSession.id ? 1 : 0));

    setSessions(updatedSessions);
    persistSessions(updatedSessions);
    setLoading(true);

    // Kirim maksimal 8 pesan terakhir ke Gemini
    const contextForAi = updatedMessages.slice(-MAX_CONTEXT_FOR_AI);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: contextForAi }),
      });
      const data = await res.json();
      const botReply: Message =
        res.ok && data.reply
          ? { role: "assistant", content: String(data.reply) }
          : { role: "assistant", content: `⚠️ ${data.error || "Gagal mendapatkan balasan dari AI. Coba periksa GEMINI_API_KEY."}` };

      setSessions((prevSessions) => {
        const newUpdated = prevSessions.map((s) => {
          if (s.id === activeSession.id) {
            return {
              ...s,
              messages: [...s.messages, botReply].slice(-MAX_MESSAGES_PER_SESSION),
              updatedAt: Date.now(),
            };
          }
          return s;
        });
        persistSessions(newUpdated);
        return newUpdated;
      });
    } catch {
      const failMsg: Message = {
        role: "assistant",
        content: "Maaf, terjadi kesalahan koneksi server. Coba lagi ya! 🙏",
      };
      setSessions((prevSessions) => {
        const newUpdated = prevSessions.map((s) => {
          if (s.id === activeSession.id) {
            return {
              ...s,
              messages: [...s.messages, failMsg].slice(-MAX_MESSAGES_PER_SESSION),
              updatedAt: Date.now(),
            };
          }
          return s;
        });
        persistSessions(newUpdated);
        return newUpdated;
      });
    }
    setLoading(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const QUICK_PROMPTS = [
    "Buatkan caption Instagram untuk promosi workshop terbaru",
    "Tips cara mengelola stok produk rajut yang efisien",
    "Template pesan WhatsApp follow-up invoice yang belum dibayar",
    "Ide konten untuk meningkatkan penjualan bouquet rajut",
  ];

  return (
    <div
      className="animate-in"
      style={{
        display: "flex",
        flexDirection: "column",
        height: isFloating ? "100%" : "calc(100vh - 120px)",
        padding: isFloating ? "4px 8px 8px" : 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ─── Top Bar / Header ─── */}
      {!isFloating ? (
        <div style={{ marginBottom: 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ background: "linear-gradient(135deg,#0ea5e9,#06b6d4)", borderRadius: 8, padding: "4px 8px", fontSize: 16 }}>🦖</span>
              AI Assistant DynoBoo
              <span className="badge badge-ai" style={{ fontSize: 10 }}>Powered by Gemini</span>
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
              Asisten bisnis DynoBoo • <span style={{ color: "#34d399", fontWeight: 600 }}>Topik terpisah • Riwayat aktif 3 hari</span>
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Tombol Riwayat Chat */}
            <button
              className={`btn btn-sm ${showHistoryPanel ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: 12, padding: "7px 12px", display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => setShowHistoryPanel((v) => !v)}
              title="Buka daftar topik percakapan"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Riwayat ({sessions.length})</span>
            </button>

            {/* Tombol Chat Baru */}
            <button
              className="btn btn-primary btn-sm"
              style={{ fontSize: 12, padding: "7px 14px", display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}
              onClick={handleCreateNewChat}
              title="Mulai topik percakapan baru"
            >
              <Icons.Plus />
              <span>+ Chat Baru</span>
            </button>
          </div>
        </div>
      ) : (
        /* Top bar di mode Floating */
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 4px 8px", borderBottom: "1px solid var(--border)", marginBottom: 8, flexShrink: 0 }}>
          <button
            className={`btn btn-sm ${showHistoryPanel ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: 11, padding: "3px 8px", height: 26, display: "flex", alignItems: "center", gap: 5 }}
            onClick={() => setShowHistoryPanel((v) => !v)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Topik ({sessions.length})</span>
          </button>

          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-secondary)",
              maxWidth: 160,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activeSession?.title || "Percakapan"}
          </span>

          <button
            className="btn btn-primary btn-sm"
            style={{ fontSize: 11, padding: "3px 8px", height: 26, display: "flex", alignItems: "center", gap: 4 }}
            onClick={handleCreateNewChat}
            title="Percakapan baru"
          >
            <Icons.Plus />
            <span>Baru</span>
          </button>
        </div>
      )}

      {/* ─── OVERLAY / DRAWER: Riwayat Sesi Percakapan ─── */}
      {showHistoryPanel && (
        <div
          style={{
            position: "absolute",
            top: isFloating ? 42 : 56,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 30,
            background: "var(--bg-card)",
            border: "1px solid var(--border-2)",
            borderRadius: 12,
            boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "chatBubbleIn 0.2s ease-out",
          }}
        >
          {/* Header Drawer */}
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-card-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>Daftar Topik Percakapan</p>
              <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>Tersimpan max 3 hari • Otomatis dibersihkan</p>
            </div>
            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowHistoryPanel(false)} style={{ width: 26, height: 26 }}>
              <Icons.X />
            </button>
          </div>

          {/* List Sesi */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
            {sessions.map((sess) => {
              const isActive = sess.id === activeSessionId;
              const isConfirming = deleteConfirmId === sess.id;
              return (
                <div
                  key={sess.id}
                  onClick={() => handleSelectSession(sess.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: isActive ? "rgba(14,165,233,0.12)" : "var(--bg-card-2)",
                    border: isActive ? "1px solid rgba(14,165,233,0.4)" : "1px solid var(--border)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
                    <p
                      style={{
                        fontWeight: isActive ? 700 : 500,
                        fontSize: 13,
                        color: isActive ? "#38bdf8" : "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        margin: 0,
                      }}
                    >
                      {sess.title || "Percakapan Baru"}
                    </p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>🕒 {formatTimeAgo(sess.updatedAt || sess.createdAt)}</span>
                      <span>•</span>
                      <span>{sess.messages.length} pesan</span>
                    </p>
                  </div>

                  {/* Tombol Hapus Sesi */}
                  <button
                    className={`btn btn-sm ${isConfirming ? "btn-danger" : "btn-secondary"}`}
                    style={{
                      padding: isConfirming ? "2px 8px" : "4px",
                      fontSize: 10,
                      height: 24,
                      flexShrink: 0,
                      borderRadius: 6,
                    }}
                    onClick={(e) => handleDeleteSession(sess.id, e)}
                    title="Hapus topik ini"
                  >
                    {isConfirming ? "Hapus?" : <Icons.Trash />}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer Drawer */}
          <div
            style={{
              padding: "10px 14px",
              borderTop: "1px solid var(--border)",
              background: "var(--bg-card-2)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: "5px 10px" }} onClick={handleClearAllSessions}>
              <Icons.Trash /> Bersihkan Semua
            </button>
            <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: "5px 12px" }} onClick={handleCreateNewChat}>
              <Icons.Plus /> Topik Baru
            </button>
          </div>
        </div>
      )}

      {/* ─── Chat Area ─── */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16, paddingRight: 4 }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            {msg.role === "assistant" && (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#0ea5e9,#06b6d4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginRight: 8,
                  fontSize: 14,
                  alignSelf: "flex-end",
                }}
              >
                🦖
              </div>
            )}
            <div
              style={{
                maxWidth: isFloating ? "85%" : "72%",
                padding: "10px 14px",
                borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
                background: msg.role === "user" ? "linear-gradient(135deg,#0284c7,#06b6d4)" : "var(--bg-card)",
                color: msg.role === "user" ? "white" : "var(--text-primary)",
                border: msg.role === "assistant" ? "1px solid var(--border)" : "none",
                fontSize: 13,
                lineHeight: 1.6,
                boxShadow: msg.role === "user" ? "0 4px 16px rgba(14,165,233,0.3)" : "var(--shadow-card)",
              }}
            >
              <FormattedMessage content={msg.content} isUser={msg.role === "user"} />
            </div>
            {msg.role === "user" && (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginLeft: 8,
                  fontSize: 14,
                  alignSelf: "flex-end",
                }}
              >
                👤
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#0ea5e9,#06b6d4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                animation: "trexBounce 0.8s ease-in-out infinite",
              }}
            >
              🦖
            </div>
            <div style={{ padding: "10px 16px", borderRadius: "4px 16px 16px 16px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#38bdf8", animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                ))}
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>🦖 sedang berpikir...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts — hanya jika percakapan sesi ini masih baru */}
      {messages.length <= 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, flexShrink: 0 }}>
          {QUICK_PROMPTS.map((p, i) => (
            <button
              key={i}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11, padding: "4px 8px" }}
              onClick={() => {
                setInput(p);
                inputRef.current?.focus();
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{ flexShrink: 0, display: "flex", gap: 8, background: "var(--bg-card)", border: "1px solid var(--border-2)", borderRadius: 12, padding: "8px 10px" }}>
        <textarea
          ref={inputRef}
          className="input"
          style={{ flex: 1, border: "none", background: "transparent", resize: "none", fontSize: 13, padding: "4px 0", minHeight: 38, maxHeight: 110 }}
          placeholder="Ketik pesan... (Enter kirim, Shift+Enter baris baru)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
        />
        <button className="btn btn-primary btn-sm btn-icon" style={{ alignSelf: "flex-end", padding: "8px 10px" }} onClick={send} disabled={loading || !input.trim()}>
          <Icons.Send />
        </button>
      </div>

      <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, textAlign: "center", flexShrink: 0 }}>
        Topik aktif: <strong style={{ color: "var(--text-secondary)" }}>{activeSession?.title || "Percakapan"}</strong> • Auto-clean 3 hari
      </p>

      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        @keyframes trexBounce { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-4px) rotate(5deg)} }
      `}</style>
    </div>
  );
}
