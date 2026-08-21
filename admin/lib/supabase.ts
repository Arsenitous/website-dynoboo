import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Chatbot Types ────────────────────────────────────────────────────────────

export type PilihanJawaban = {
  opsi: string;
  jawaban: string;
};

export type KnowledgeBase = {
  id: number;
  keywords: string;
  jawaban_utama: string;
  pilihan_jawaban: PilihanJawaban[] | null;
  keterangan: string | null;
  edited_by?: string;
  created_at: string;
};

export type Workshop = {
  id: number;
  nama_workshop: string;
  tanggal: string;
  harga_promo: string | null;
  harga_normal: string | null;
  fasilitas: string | null;
  status: "ACTIVE" | "UPCOMING" | "CLOSED";
  is_active: boolean;
  edited_by?: string;
  created_at: string;
};

export type Pesanan = {
  id: number;
  sender_id: string;
  nama: string;
  alamat: string;
  no_hp: string;
  produk: string;
  status: "AKTIF" | "SELESAI";
  selesai_at: string | null;
  diselesaikan_oleh: string | null;
  created_at: string;
};

export type ChatLog = {
  id: number;
  sender_id: string;
  user_message: string;
  bot_response: string;
  intent: "AI_GEMINI" | "FORM_REGISTRATION" | "START_REGISTRATION";
  created_at: string;
};

export type AdminUser = {
  id: number;
  username: string;
  role: "superadmin" | "admin";
  permissions?: string[];
  created_at: string;
};

// ─── Loyalty Logbook Types ───────────────────────────────────────────────────

export type Loyalty = {
  id: number;
  nama: string;
  no_hp: string | null;
  email: string | null;
  alamat: string | null;
  catatan: string | null;
  is_active: boolean;
  created_at: string;
};

// ─── POS / Invoice Types ──────────────────────────────────────────────────────


export type RekeningInfo = {
  bank: string;
  no_rek: string;
  atas_nama: string;
};

export type CompanyProfile = {
  id: number;
  nama_toko: string;
  tagline: string | null;
  logo_url: string | null;
  alamat: string | null;
  kota: string | null;
  no_hp: string | null;
  email: string | null;
  instagram: string | null;
  rekening: RekeningInfo[];
  is_active: boolean;
  created_at: string;
};

export type InvoiceType = {
  id: number;
  nama: string;
  prefix: string;
  deskripsi: string | null;
  is_active: boolean;
  created_at: string;
};

export type ItemType = {
  id: number;
  nama: string;
  icon: string;
  created_at: string;
};

export type Item = {
  id: number;
  item_type_id: number | null;
  item_type?: ItemType;
  nama: string;
  deskripsi: string | null;
  harga_normal: number;
  harga_promo: number | null;
  satuan: string;
  gambar_url: string | null;
  is_active: boolean;
  created_at: string;
  stock?: Stock;
};

export type Stock = {
  id: number;
  item_id: number;
  qty_available: number;
  qty_sold: number;
  qty_reserved: number;
  updated_at: string;
};

export type Invoice = {
  id: number;
  invoice_no: string;
  invoice_type_id: number | null;
  invoice_type?: InvoiceType;
  invoice_date: string;
  due_date: string | null;
  customer_name: string;
  customer_contact: string | null;
  customer_address: string | null;
  customer_email: string | null;
  subtotal: number;
  discount: number;
  dp_amount: number;
  grand_total: number;
  sisa_tagihan: number;
  status_pembayaran: "UNPAID" | "DP" | "PAID" | "CANCELLED";
  pesanan_id: number | null;
  catatan: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  invoice_items?: InvoiceItem[];
  payments?: Payment[];
};

export type InvoiceItem = {
  id: number;
  invoice_id: number;
  item_id: number | null;
  description: string;
  qty: number;
  satuan: string;
  harga_satuan: number;
  total_harga: number;
  created_at: string;
};

export type Payment = {
  id: number;
  invoice_id: number;
  tanggal_bayar: string;
  jumlah: number;
  metode: "Transfer" | "Cash" | "QRIS" | "Other";
  tipe: "DP" | "Pelunasan" | "Full";
  bukti_url: string | null;
  catatan: string | null;
  dicatat_oleh: string;
  created_at: string;
};

// ─── Financial Report Types ───────────────────────────────────────────────────

export type FinancialCategory = {
  id: number;
  nama: string;
  tipe: "PEMASUKAN" | "PENGELUARAN";
  warna: string;
  created_at: string;
};

export type FinancialTransaction = {
  id: number;
  tipe: "PEMASUKAN" | "PENGELUARAN";
  kategori_id: number | null;
  kategori?: FinancialCategory;
  nominal: number;
  detail: string | null;
  deskripsi: string | null;
  tanggal: string;
  payment_id: number | null;   // linked invoice payment (if imported)
  created_by: string;
  created_at: string;
  updated_at: string;
};

// Payment enriched with invoice info + import status
export type PaymentWithInvoice = Payment & {
  invoice?: Pick<Invoice, "id" | "invoice_no" | "customer_name" | "customer_contact" | "grand_total" | "sisa_tagihan" | "status_pembayaran" | "catatan">;
  sudah_diimport: boolean;
  financial_transaction_id?: number;
};
