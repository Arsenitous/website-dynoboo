-- ================================================================
-- DYNOBOO Migration 007: Link payments → financial_transactions
-- Run di: Supabase Dashboard → SQL Editor
-- ================================================================

-- Tambah kolom payment_id ke financial_transactions
-- Nullable: transaksi manual tidak punya payment_id
ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS payment_id BIGINT REFERENCES payments(id) ON DELETE SET NULL;

-- Index untuk lookup cepat
CREATE INDEX IF NOT EXISTS idx_financial_transactions_payment_id
  ON financial_transactions(payment_id);
