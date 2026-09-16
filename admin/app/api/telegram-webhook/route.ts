import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function sendTelegramMessage(chatId: number | string, text: string) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not set!");
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    // Fallback plain text if markdown parse error
    if (!res.ok) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    }
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
  }
}

async function saveToSupabase(data: {
  telegram_chat_id: number;
  telegram_username: string;
  nama_pembeli: string;
  jenis_pesanan: string;
  rincian_pesanan: string;
  catatan: string | null;
}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Supabase env vars not set!");
    return { data: null, error: new Error("Supabase not configured") };
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/pre_orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "return=representation",
    },
    body: JSON.stringify([{ ...data, status: "PENDING" }]),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { data: null, error: new Error(errText) };
  }

  const rows = await res.json();
  return { data: rows[0] ?? null, error: null };
}

async function parseOrderWithGemini(text: string) {
  if (!GEMINI_API_KEY) {
    console.log("GEMINI_API_KEY not set, using fallback parser");
    return null;
  }
  try {
    const prompt = `Kamu adalah AI parser pesanan untuk toko DynoBoo (Spesialis Produk Rajut & Workshop).
Ekstrak informasi pesanan dari teks berikut ke dalam format JSON murni TANPA markdown block.
Teks: "${text}"

Output JSON dengan key:
- nama_pembeli: (nama pelanggan, default "Pelanggan Telegram")
- jenis_pesanan: (WORKSHOP atau PRODUK atau PRODUK & WORKSHOP)
- rincian_pesanan: (detail item, kuantitas, warna/tipe jika ada)
- catatan: (catatan kustom, tgl, metode bayar, no hp jika ada, atau "-")`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;
    const cleanJson = rawText.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("Gemini parse error:", e);
    return null;
  }
}

function parseOrderFallback(text: string) {
  const lines = text.split("\n");
  let nama = "";
  let jenis = "PRODUK";
  let rincian = "";
  let catatan = "";

  lines.forEach((line) => {
    const l = line.trim();
    if (/^nama\s*:/i.test(l)) nama = l.replace(/^nama\s*:/i, "").trim();
    else if (/^jenis\s*:/i.test(l)) jenis = l.replace(/^jenis\s*:/i, "").trim();
    else if (/^rincian\s*:/i.test(l) || /^pesanan\s*:/i.test(l)) rincian = l.replace(/^(rincian|pesanan)\s*:/i, "").trim();
    else if (/^catatan\s*:/i.test(l)) catatan = l.replace(/^catatan\s*:/i, "").trim();
  });

  if (!nama && !rincian) {
    rincian = text.trim();
    nama = "Pelanggan Telegram";
  }

  return {
    nama_pembeli: nama || "Pelanggan Telegram",
    jenis_pesanan: jenis || "PRODUK",
    rincian_pesanan: rincian || text.trim(),
    catatan: catatan || "-",
  };
}

export async function POST(req: Request) {
  try {
    const update = await req.json();
    const message = update?.message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true, status: "No message text" });
    }

    const chatId = message.chat.id;
    const username = message.from?.username
      ? `@${message.from.username}`
      : message.from?.first_name || "Tim DynoBoo";
    const userText = message.text.trim();

    // Handle /start and /help
    if (userText === "/start" || userText === "/help") {
      const helpMsg = `👋 *Halo Tim DynoBoo!*\n\nBot ini berfungsi untuk mencatat *Pesanan Sementara (Pre-Order)* langsung ke Web Admin.\n\n💡 *Cara Penggunaan:*\nKirim chat berisi rincian pesanan yang kamu terima dari WA/IG/Offline Event.\n\n*Format Bebas (AI Powered):*\n_"Catat orderan dari Kak Sinta, produk Tote Bag Rajut warna Sage 1pcs, catatan DP 50rb via BCA"_\n\n*Atau Format Terstruktur:*\n*Nama:* Budi Santoso\n*Jenis:* Workshop\n*Rincian:* 2 Pax Workshop Rajut Pemula (20 Sept)\n*Catatan:* Transfer Lunas\n\nPesanan yang dikirim akan langsung muncul di *Web Admin DynoBoo* halaman *Daftar Pre-Order Masuk*!`;
      await sendTelegramMessage(chatId, helpMsg);
      return NextResponse.json({ ok: true });
    }

    // Parse order
    let parsedData = await parseOrderWithGemini(userText);
    if (!parsedData || !parsedData.nama_pembeli || !parsedData.rincian_pesanan) {
      parsedData = parseOrderFallback(userText);
    }

    // Save to Supabase directly via REST API
    const { data: newPreOrder, error: dbError } = await saveToSupabase({
      telegram_chat_id: chatId,
      telegram_username: username,
      nama_pembeli: parsedData.nama_pembeli,
      jenis_pesanan: parsedData.jenis_pesanan || "PRODUK",
      rincian_pesanan: parsedData.rincian_pesanan,
      catatan: parsedData.catatan && parsedData.catatan !== "-" ? parsedData.catatan : null,
    });

    if (dbError) {
      console.error("Supabase insert error:", dbError);
      await sendTelegramMessage(
        chatId,
        `⚠️ *Gagal mencatat pesanan!*\nKendala: ${dbError.message}\n\nCoba lagi atau hubungi admin.`
      );
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    const orderId = newPreOrder?.id ?? "?";
    const successMsg = `✅ *Pesanan berhasil dicatat ke antrean Pre-Order!*\n\n🆔 *ID Pre-Order:* #${orderId}\n👤 *Pembeli:* ${parsedData.nama_pembeli}\n📦 *Jenis:* ${parsedData.jenis_pesanan}\n📝 *Rincian:* ${parsedData.rincian_pesanan}\n🗒 *Catatan:* ${parsedData.catatan || "-"}\n\nStatus: *PENDING* - Admin akan memproses menjadi invoice resmi di Web Admin DynoBoo.`;

    await sendTelegramMessage(chatId, successMsg);

    return NextResponse.json({ ok: true, pre_order: newPreOrder });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("Telegram webhook error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}