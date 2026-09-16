import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function computeMatchScore(wsName: string, desc: string): number {
  const normWs = normalizeText(wsName);
  const normDesc = normalizeText(desc);

  if (!normWs || !normDesc) return 0;

  // Exact match (ignoring case & symbols)
  if (normWs === normDesc) return 100;

  // Substring match
  if (normDesc.includes(normWs) || normWs.includes(normDesc)) return 80;

  // Specific keyword rules for DynoBoo workshops
  if ((normWs.includes("bank kalbar") || normWs.includes("iwaba")) && (normDesc.includes("bank kalbar") || normDesc.includes("iwaba"))) return 90;
  if (normWs.includes("tashirojima") && normDesc.includes("tashirojima")) return 90;
  if (normWs.includes("lurkers") && normDesc.includes("lurkers")) return 90;
  if (normWs.includes("koala") && normDesc.includes("koala")) return 90;
  if (normWs.includes("kaveline") && normDesc.includes("kaveline")) return 90;
  if (normWs.includes("penguin") && normDesc.includes("penguin")) return 90;
  if (normWs.includes("jam tangan") && normDesc.includes("jam tangan")) return 90;
  if (normWs.includes("cattu") && normDesc.includes("cattu")) return 90;
  if (normWs.includes("flower pot") && normDesc.includes("flower pot") && !normDesc.includes("bank kalbar")) return 90;
  if (normWs.includes("sunflower") && normDesc.includes("sunflower")) return 90;
  if (normWs.includes("patrick") && normDesc.includes("patrick")) return 90;

  return 0;
}

export async function GET() {
  try {
    const { data: workshops, error: wsErr } = await supabase.from("workshops").select("*").order("id", { ascending: true });
    if (wsErr || !workshops) {
      console.error("Workshops fetch error:", wsErr);
      return NextResponse.json([]);
    }

    const { data: invoices, error: invErr } = await supabase.from("invoices").select("id").neq("status_pembayaran", "CANCELLED");
    if (invErr || !invoices || invoices.length === 0) {
      return NextResponse.json(workshops.map(w => ({ ...w, tiket_terjual: 0 })));
    }

    const activeInvoiceIds = invoices.map(i => i.id);

    const { data: invoiceItems, error: itemsErr } = await supabase
      .from("invoice_items")
      .select("*")
      .in("invoice_id", activeInvoiceIds);

    if (itemsErr) {
      console.error("Invoice items fetch error:", itemsErr);
    }

    const soldMap: Record<number, number> = {};
    workshops.forEach(w => { soldMap[w.id] = 0; });

    for (const item of (invoiceItems || [])) {
      if (!item.description) continue;

      let bestMatchId: number | null = null;
      let maxScore = 0;

      for (const ws of workshops) {
        const score = computeMatchScore(ws.nama_workshop, item.description);
        if (score > maxScore && score >= 50) {
          maxScore = score;
          bestMatchId = ws.id;
        }
      }

      if (bestMatchId !== null) {
        soldMap[bestMatchId] = (soldMap[bestMatchId] || 0) + (item.qty || 1);
      }
    }

    const result = workshops.map(w => ({
      ...w,
      tiket_terjual: soldMap[w.id] || 0
    }));

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("API GET /api/workshops/sales error:", err);
    return NextResponse.json([]);
  }
}