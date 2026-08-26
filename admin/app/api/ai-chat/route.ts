import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

// ─── Gemini Content Types ──────────────────────────────────────────────────────

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: { result: unknown } } };

type GeminiContent = {
  role: string;
  parts: GeminiPart[];
};

const MODELS_TO_TRY = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-pro",
];

// ─── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Kamu adalah asisten pribadi admin DynoBoo bernama "Dyna", sebuah toko kerajinan tangan yang menjual produk rajut, boneka crochet, aksesori manik-manik, dan menyelenggarakan workshop.

Kamu memiliki akses ke database toko secara real-time melalui tools yang tersedia. SELALU gunakan tools untuk menjawab pertanyaan yang berkaitan dengan data toko (workshop, produk, stok, invoice, pesanan, keuangan, member).

PENTING — Kapan menggunakan tools:
- Pertanyaan tentang workshop → gunakan get_workshops
- Pertanyaan tentang produk atau stok → gunakan get_items
- Pertanyaan tentang invoice, tagihan, pembayaran → gunakan get_invoices
- Pertanyaan tentang pesanan masuk → gunakan get_pesanan
- Pertanyaan tentang keuangan, pemasukan, pengeluaran → gunakan get_financial_summary
- Pertanyaan tentang member loyalty → gunakan get_loyalty_members
- Pertanyaan tentang profil toko → gunakan get_company_profile
- Jika pertanyaan butuh beberapa data sekaligus → panggil beberapa tools

Saat menampilkan data:
- Gunakan format yang rapi dan mudah dibaca (list, tabel jika perlu)
- Cantumkan detail penting (harga, tanggal, status, stok)
- Jika data kosong, sampaikan dengan jelas
- Berikan insight atau saran singkat jika relevan

Tugas lain (tanpa tools):
- Membantu membuat caption Instagram, pesan WhatsApp, teks promosi
- Memberikan saran pemasaran dan pengelolaan bisnis
- Menjelaskan cara penggunaan fitur admin panel

Selalu jawab dalam Bahasa Indonesia yang ramah dan profesional. Panggil admin dengan "Kak" untuk kesan hangat.`;

// ─── Tool Declarations ─────────────────────────────────────────────────────────

const TOOL_DECLARATIONS = [
  {
    name: "get_workshops",
    description:
      "Ambil data workshop dari database. Bisa filter berdasarkan status. Gunakan ini untuk pertanyaan tentang workshop aktif, jadwal, harga, atau fasilitas.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["ACTIVE", "UPCOMING", "CLOSED", "ALL"],
          description:
            "Filter status workshop. Gunakan ALL untuk semua workshop. Default: ALL.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_items",
    description:
      "Ambil data produk dan stok dari database. Gunakan ini untuk pertanyaan tentang produk yang tersedia, harga, atau jumlah stok.",
    parameters: {
      type: "object",
      properties: {
        only_active: {
          type: "boolean",
          description:
            "Jika true, hanya tampilkan produk yang aktif. Default: true.",
        },
        low_stock_threshold: {
          type: "number",
          description:
            "Jika diisi, hanya tampilkan produk dengan stok di bawah angka ini.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_invoices",
    description:
      "Ambil data invoice dari database. Gunakan untuk pertanyaan tentang tagihan, pembayaran, invoice belum lunas, dsb.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["UNPAID", "DP", "PAID", "CANCELLED", "ALL"],
          description:
            "Filter status pembayaran invoice. Gunakan ALL untuk semua.",
        },
        bulan: {
          type: "string",
          description:
            "Filter berdasarkan bulan invoice dalam format YYYY-MM, contoh: 2026-08.",
        },
        limit: {
          type: "number",
          description: "Jumlah maksimal invoice yang ditampilkan. Default: 20.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_pesanan",
    description:
      "Ambil data pesanan masuk yang masih aktif dari database. Gunakan untuk pertanyaan tentang pesanan yang perlu diproses.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["AKTIF", "SELESAI", "ALL"],
          description: "Filter status pesanan. Default: AKTIF.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_financial_summary",
    description:
      "Ambil ringkasan keuangan (pemasukan dan pengeluaran) dari database. Gunakan untuk pertanyaan tentang omzet, keuntungan, laporan keuangan.",
    parameters: {
      type: "object",
      properties: {
        tahun: {
          type: "string",
          description:
            "Filter berdasarkan tahun, contoh: 2026. Jika tidak diisi, ambil semua data.",
        },
        bulan: {
          type: "string",
          description:
            "Filter berdasarkan bulan (1-12). Harus disertai tahun jika diisi.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_loyalty_members",
    description:
      "Ambil data member loyalty dari database. Gunakan untuk pertanyaan tentang jumlah member, data pelanggan setia.",
    parameters: {
      type: "object",
      properties: {
        only_active: {
          type: "boolean",
          description:
            "Jika true, hanya tampilkan member aktif. Default: true.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_company_profile",
    description:
      "Ambil data profil toko DynoBoo dari database (nama, alamat, kontak, rekening, dsb).",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// ─── Tool Executors ────────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "get_workshops": {
      const status = (args.status as string) ?? "ALL";
      let query = supabase
        .from("workshops")
        .select("*")
        .order("tanggal", { ascending: true });
      if (status !== "ALL") {
        query = query.eq("status", status);
      }
      const { data, error } = await query;
      if (error) return { error: error.message };
      return {
        total: data?.length ?? 0,
        workshops: data ?? [],
      };
    }

    case "get_items": {
      const onlyActive = args.only_active !== false;
      const lowStock = args.low_stock_threshold as number | undefined;

      let query = supabase
        .from("items")
        .select("*, item_type:item_types(nama, icon), stock:stocks(*)")
        .order("nama", { ascending: true });

      if (onlyActive) query = query.eq("is_active", true);
      if (lowStock !== undefined) {
        // We'll filter after fetch since Supabase can't filter on nested column easily
      }

      const { data, error } = await query;
      if (error) return { error: error.message };

      let items = data ?? [];
      if (lowStock !== undefined) {
        items = items.filter(
          (item: { stock?: { qty_available?: number } }) =>
            (item.stock?.qty_available ?? 0) <= lowStock
        );
      }

      return {
        total: items.length,
        items: items.map(
          (item: {
            id: number;
            nama: string;
            harga_normal: number;
            harga_promo?: number | null;
            satuan: string;
            is_active: boolean;
            item_type?: { nama: string; icon: string };
            stock?: { qty_available?: number; qty_sold?: number };
          }) => ({
            id: item.id,
            nama: item.nama,
            tipe: item.item_type?.nama ?? "-",
            harga_normal: item.harga_normal,
            harga_promo: item.harga_promo,
            satuan: item.satuan,
            stok_tersedia: item.stock?.qty_available ?? 0,
            stok_terjual: item.stock?.qty_sold ?? 0,
            is_active: item.is_active,
          })
        ),
      };
    }

    case "get_invoices": {
      const status = (args.status as string) ?? "ALL";
      const bulan = args.bulan as string | undefined;
      const limit = (args.limit as number) ?? 20;

      let query = supabase
        .from("invoices")
        .select("id, invoice_no, invoice_date, due_date, customer_name, customer_contact, grand_total, sisa_tagihan, status_pembayaran, catatan, invoice_type:invoice_types(nama, prefix)")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status !== "ALL") query = query.eq("status_pembayaran", status);
      if (bulan) {
        const [yr, mo] = bulan.split("-");
        const endDate = new Date(Number(yr), Number(mo), 0);
        query = query
          .gte("invoice_date", `${bulan}-01`)
          .lte("invoice_date", endDate.toISOString().split("T")[0]);
      }

      const { data, error } = await query;
      if (error) return { error: error.message };

      const invoices = data ?? [];
      const totalTagihan = invoices.reduce(
        (sum: number, inv: { sisa_tagihan?: number }) => sum + (inv.sisa_tagihan ?? 0),
        0
      );
      const totalNilai = invoices.reduce(
        (sum: number, inv: { grand_total?: number }) => sum + (inv.grand_total ?? 0),
        0
      );

      return {
        total: invoices.length,
        total_nilai: totalNilai,
        total_sisa_tagihan: totalTagihan,
        invoices,
      };
    }

    case "get_pesanan": {
      const status = (args.status as string) ?? "AKTIF";
      let query = supabase
        .from("pesanan")
        .select("*")
        .order("created_at", { ascending: false });

      if (status !== "ALL") query = query.eq("status", status);

      const { data, error } = await query;
      if (error) return { error: error.message };

      return {
        total: data?.length ?? 0,
        pesanan: data ?? [],
      };
    }

    case "get_financial_summary": {
      const tahun = args.tahun as string | undefined;
      const bulan = args.bulan as string | undefined;

      let query = supabase
        .from("financial_transactions")
        .select("tipe, nominal, tanggal, kategori:financial_categories(nama, tipe)")
        .order("tanggal", { ascending: false });

      if (tahun && bulan) {
        const month = bulan.padStart(2, "0");
        query = query
          .gte("tanggal", `${tahun}-${month}-01`)
          .lte("tanggal", `${tahun}-${month}-31`);
      } else if (tahun) {
        query = query
          .gte("tanggal", `${tahun}-01-01`)
          .lte("tanggal", `${tahun}-12-31`);
      }

      const { data, error } = await query;
      if (error) return { error: error.message };

      const transactions = data ?? [];
      const pemasukan = transactions
        .filter((t: { tipe: string }) => t.tipe === "PEMASUKAN")
        .reduce((sum: number, t: { nominal: number }) => sum + t.nominal, 0);
      const pengeluaran = transactions
        .filter((t: { tipe: string }) => t.tipe === "PENGELUARAN")
        .reduce((sum: number, t: { nominal: number }) => sum + t.nominal, 0);

      return {
        total_transaksi: transactions.length,
        total_pemasukan: pemasukan,
        total_pengeluaran: pengeluaran,
        saldo_bersih: pemasukan - pengeluaran,
        periode: tahun && bulan ? `${bulan}/${tahun}` : tahun ? tahun : "semua waktu",
      };
    }

    case "get_loyalty_members": {
      const onlyActive = args.only_active !== false;

      let query = supabase
        .from("loyalty")
        .select("id, nama, no_hp, email, is_active, created_at")
        .order("created_at", { ascending: false });

      if (onlyActive) query = query.eq("is_active", true);

      const { data, error } = await query;
      if (error) return { error: error.message };

      return {
        total: data?.length ?? 0,
        members: data ?? [],
      };
    }

    case "get_company_profile": {
      const { data, error } = await supabase
        .from("company_profiles")
        .select("*")
        .eq("is_active", true)
        .single();

      if (error) return { error: error.message };
      return data;
    }

    default:
      return { error: `Tool "${name}" tidak dikenal.` };
  }
}

// ─── Main Handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "GEMINI_API_KEY belum diisi di .env.local" },
        { status: 400 }
      );
    }

    // Build Gemini contents from message history
    const buildContents = (
      msgs: { role: string; content: string }[]
    ): GeminiContent[] => {
      const mapped = msgs
        .filter((m) => m.content && m.content.trim() !== "")
        .map((m): GeminiContent => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
      // Ensure conversation starts with user turn
      if (mapped.length > 0 && mapped[0].role === "model") mapped.shift();
      return mapped;
    };

    const basePayload = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    };

    let contents: GeminiContent[] = buildContents(messages || []);
    if (contents.length === 0) {
      contents = [{ role: "user", parts: [{ text: "Halo" }] }];
    }

    // ── Agentic loop: handle function calling ──────────────────────────────────
    // Max 5 iterations to prevent infinite loops
    for (let iteration = 0; iteration < 5; iteration++) {
      // Try models in fallback order
      let lastError = "";
      let result: {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
              functionCall?: { name: string; args: Record<string, unknown> };
            }>;
            role?: string;
          };
          finishReason?: string;
        }>;
        error?: { message: string };
      } | null = null;
      let chosenModel = "";

      for (const modelName of MODELS_TO_TRY) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...basePayload, contents }),
        });

        result = await res.json();

        if (res.ok && result?.candidates?.[0]) {
          chosenModel = modelName;
          break;
        }

        lastError = result?.error?.message || `Error ${res.status}`;
      }

      if (!result?.candidates?.[0]) {
        return Response.json(
          { error: lastError || "Gagal menghubungi model Gemini." },
          { status: 400 }
        );
      }

      const candidate = result.candidates[0];
      const candidateContent = candidate.content;
      const parts = candidateContent?.parts ?? [];

      // Check if there are function calls to execute
      const functionCalls = parts.filter((p) => p.functionCall);

      if (functionCalls.length === 0) {
        // No function calls — this is the final text response
        const text = parts
          .filter((p) => p.text)
          .map((p) => p.text)
          .join("");

        if (text) {
          return Response.json({ reply: text, model: chosenModel });
        }

        return Response.json(
          { error: "Model tidak menghasilkan respons." },
          { status: 400 }
        );
      }

      // ── Execute all requested function calls ───────────────────────────────────────────
      // Append the model's function call message to contents
      const modelFcParts: GeminiPart[] = functionCalls
        .filter((p): p is { functionCall: { name: string; args: Record<string, unknown> } } => !!p.functionCall)
        .map((p) => ({ functionCall: p.functionCall }));

      contents = [
        ...contents,
        { role: "model", parts: modelFcParts },
      ];

      // Execute each tool and collect responses
      const functionResponses: GeminiPart[] = await Promise.all(
        functionCalls
          .filter((p): p is { functionCall: { name: string; args: Record<string, unknown> } } => !!p.functionCall)
          .map(async (p) => {
            const fc = p.functionCall;
            const toolResult = await executeTool(fc.name, fc.args ?? {});
            return {
              functionResponse: {
                name: fc.name,
                response: { result: toolResult },
              },
            } satisfies GeminiPart;
          })
      );

      // Append function responses to contents for next iteration
      contents = [
        ...contents,
        {
          role: "user",
          parts: functionResponses,
        },
      ];

      // Loop again so the model can use the function results to formulate an answer
    }

    return Response.json(
      { error: "Terlalu banyak iterasi function calling." },
      { status: 500 }
    );
  } catch (err: unknown) {
    const error = err as Error;
    return Response.json(
      { error: error.message || "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
