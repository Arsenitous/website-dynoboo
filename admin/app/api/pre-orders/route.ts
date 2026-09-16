import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("pre_orders")
      .select(`
        *,
        invoice:invoices(id, invoice_no, customer_name, grand_total, status_pembayaran)
      `)
      .order("created_at", { ascending: false });

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { data, error } = await supabase
      .from("pre_orders")
      .insert([
        {
          telegram_chat_id: body.telegram_chat_id || 0,
          telegram_username: body.telegram_username || "Web Admin",
          nama_pembeli: body.nama_pembeli,
          jenis_pesanan: body.jenis_pesanan || "PRODUK",
          rincian_pesanan: body.rincian_pesanan,
          catatan: body.catatan || null,
          status: body.status || "PENDING",
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}