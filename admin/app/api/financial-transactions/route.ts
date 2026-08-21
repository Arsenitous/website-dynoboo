import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const tipe = sp.get("tipe");
  const tahun = sp.get("tahun");
  const bulan = sp.get("bulan");

  let query = supabase
    .from("financial_transactions")
    .select("*, kategori:financial_categories(*)")
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false });

  if (tipe) query = query.eq("tipe", tipe);

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
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const cookieStore = await cookies();
  const user = cookieStore.get("dynoboo_user")?.value ?? "superadmin";

  const { tipe, kategori_id, nominal, detail, deskripsi, tanggal, payment_id } = body;
  if (!tipe || !nominal || !tanggal) {
    return Response.json({ error: "tipe, nominal, dan tanggal wajib diisi" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("financial_transactions")
    .insert({
      tipe,
      kategori_id: kategori_id ?? null,
      nominal: Number(nominal),
      detail: detail?.trim() ?? null,
      deskripsi: deskripsi?.trim() ?? null,
      tanggal,
      payment_id: payment_id ?? null,
      created_by: user,
      updated_at: new Date().toISOString(),
    })
    .select("*, kategori:financial_categories(*)")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}
