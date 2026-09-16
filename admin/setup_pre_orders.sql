-- =========================================================================
-- SQL Migration Script: Pre-Order Table for Telegram Bot Integration
-- Run this script in your Supabase SQL Editor
-- =========================================================================

CREATE TABLE IF NOT EXISTS pre_orders (
  id SERIAL PRIMARY KEY,
  telegram_chat_id BIGINT NOT NULL DEFAULT 0,
  telegram_username TEXT,
  nama_pembeli TEXT NOT NULL,
  jenis_pesanan TEXT NOT NULL DEFAULT 'PRODUK',
  rincian_pesanan TEXT NOT NULL,
  catatan TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'DIPROSES' | 'DIBATALKAN'
  invoice_id INT REFERENCES invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast status filtering & created_at sorting
CREATE INDEX IF NOT EXISTS idx_pre_orders_status ON pre_orders(status);
CREATE INDEX IF NOT EXISTS idx_pre_orders_created_at ON pre_orders(created_at DESC);

-- Enable RLS (Row Level Security) if needed or grant permissions
ALTER TABLE pre_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access" ON pre_orders FOR ALL USING (true) WITH CHECK (true);