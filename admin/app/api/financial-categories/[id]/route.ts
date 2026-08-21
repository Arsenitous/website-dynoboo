import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { nama, tipe, warna } = body;
  const { data, error } = await supabase
    .from("financial_categories")
    .update({ nama: nama?.trim(), tipe, warna })
    .eq("id", Number(id))
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await supabase
    .from("financial_categories")
    .delete()
    .eq("id", Number(id));
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
