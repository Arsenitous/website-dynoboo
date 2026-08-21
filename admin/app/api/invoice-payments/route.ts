import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  // 1. Fetch payments only from non-cancelled invoices (excluding skipped)
  const { data: payments, error } = await supabase
    .from("payments")
    .select(`
      id, invoice_id, tanggal_bayar, jumlah, metode, tipe, bukti_url, catatan, dicatat_oleh, created_at, is_skipped,
      invoices:invoice_id (
        id, invoice_no, customer_name, customer_contact,
        grand_total, sisa_tagihan, status_pembayaran, catatan
      )
    `)
    .not("invoices.status_pembayaran", "eq", "CANCELLED")
    .eq("is_skipped", false)
    .order("tanggal_bayar", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // 2. Fetch all financial_transactions that have a payment_id (imported ones)
  const { data: imported } = await supabase
    .from("financial_transactions")
    .select("id, payment_id")
    .not("payment_id", "is", null);

  const importedMap = new Map<number, number>();
  (imported ?? []).forEach((t: { id: number; payment_id: number }) => {
    importedMap.set(t.payment_id, t.id);
  });

  // 3. Enrich each payment with import status
  // Also filter out payments from CANCELLED invoices (JS safety net)
  const enriched = (payments ?? [])
    .map((p: any) => ({
      ...p,
      invoice: Array.isArray(p.invoices) ? p.invoices[0] : p.invoices,
      sudah_diimport: importedMap.has(p.id),
      financial_transaction_id: importedMap.get(p.id) ?? null,
    }))
    .filter((p: any) => p.invoice && p.invoice.status_pembayaran !== "CANCELLED");

  return Response.json(enriched);
}
