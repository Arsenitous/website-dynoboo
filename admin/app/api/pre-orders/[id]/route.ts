import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegramMessage(chatId: number | string, text: string) {
  if (!TELEGRAM_BOT_TOKEN || !chatId || chatId == 0) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown",
      }),
    });
  } catch (err) {
    console.error("Failed to send Telegram notification:", err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const preOrderId = parseInt(id, 10);
    if (isNaN(preOrderId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const { data: currentOrder, error: fetchErr } = await supabase
      .from("pre_orders")
      .select("*")
      .eq("id", preOrderId)
      .single();

    if (fetchErr || !currentOrder) {
      return NextResponse.json({ error: "Pre-order not found" }, { status: 404 });
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (body.status) updates.status = body.status;
    if (body.invoice_id !== undefined) updates.invoice_id = body.invoice_id;
    if (body.catatan !== undefined) updates.catatan = body.catatan;

    const { data: updated, error: updateErr } = await supabase
      .from("pre_orders")
      .update(updates)
      .eq("id", preOrderId)
      .select(`
        *,
        invoice:invoices(id, invoice_no, customer_name, grand_total, status_pembayaran)
      `)
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    if (body.status === "DIPROSES" && (body.invoice_id || updated.invoice_id)) {
      const invNo = updated.invoice?.invoice_no || body.invoice_no || `#INV-${body.invoice_id}`;
      const buyerName = updated.nama_pembeli;
      const chatId = updated.telegram_chat_id;

      if (chatId) {
        const notifMsg = `🎉 *Invoice Resmi Diterbitkan!*\n\nInvoice resmi *${invNo}* untuk *${buyerName}* sudah berhasil diterbitkan!\n\n📦 *Pre-Order ID:* #${updated.id}\n👤 *Pembeli:* ${buyerName}\n📝 *Rincian:* ${updated.rincian_pesanan}\n status: *DIPROSES* (Invoice Resmi Terbit)`;
        await sendTelegramMessage(chatId, notifMsg);
      }
    } else if (body.status === "DIBATALKAN" && currentOrder.status !== "DIBATALKAN") {
      const chatId = updated.telegram_chat_id;
      if (chatId) {
        const notifMsg = `❌ *Pre-Order Dibatalkan*\n\nPesanan Pre-Order #${updated.id} untuk *${updated.nama_pembeli}* telah dibatalkan oleh Admin di Web Admin.`;
        await sendTelegramMessage(chatId, notifMsg);
      }
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const preOrderId = parseInt(id, 10);
    const { error } = await supabase.from("pre_orders").delete().eq("id", preOrderId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}