import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { tipe, kategori_id, nominal, detail, deskripsi, tanggal } = body;

  const { data, error } = await supabase
    .from("financial_transactions")
    .update({
      tipe,
      kategori_id: kategori_id ?? null,
      nominal: Number(nominal),
      detail: detail?.trim() ?? null,
      deskripsi: deskripsi?.trim() ?? null,
      tanggal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", Number(id))
    .select("*, kategori:financial_categories(*)")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await supabase
    .from("financial_transactions")
    .delete()
    .eq("id", Number(id));
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
