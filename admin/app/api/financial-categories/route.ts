import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const tipe = request.nextUrl.searchParams.get("tipe");
  let query = supabase
    .from("financial_categories")
    .select("*")
    .order("nama", { ascending: true });
  if (tipe) query = query.eq("tipe", tipe);
  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nama, tipe, warna } = body;
  if (!nama || !tipe) return Response.json({ error: "nama dan tipe wajib diisi" }, { status: 400 });
  const { data, error } = await supabase
    .from("financial_categories")
    .insert({ nama: nama.trim(), tipe, warna: warna ?? "#38bdf8" })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
