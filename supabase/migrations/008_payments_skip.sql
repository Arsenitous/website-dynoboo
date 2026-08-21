-- ================================================================
-- DYNOBOO Migration 008: Add is_skipped to payments
-- Run di: Supabase Dashboard → SQL Editor
-- ================================================================

-- 1. Tambah kolom is_skipped
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS is_skipped BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Langsung skip SEMUA payment yang ada sekarang
--    (karena sudah diinput manual ke laporan finansial)
UPDATE payments SET is_skipped = TRUE;

-- Verifikasi
SELECT COUNT(*) AS total, 
       COUNT(*) FILTER (WHERE is_skipped) AS skipped,
       COUNT(*) FILTER (WHERE NOT is_skipped) AS active
FROM payments;
