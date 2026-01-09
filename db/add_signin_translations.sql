-- SQL Script to add new translation keys for sign-in dropdown feature
-- Generated on 2026-01-09
-- Updated: Fixed ID sequence to avoid duplicate key constraint
--
-- This script adds translations for:
--   - demo-account (示範帳戶 / Demo Account)
--   - select-account (選擇帳戶 / Select Account)
--
-- Note: Starting from ID 6718 (last record in bim-init.sql is 6717)
--
-- Usage:
--   psql -U bmms -d your_database_name -f add_signin_translations.sql

-- Insert English translations (locale_id = 1)
INSERT INTO public.core_translation (id, key, value, locale_id) VALUES
(6718, 'demo-account', 'Demo Account', 1),
(6719, 'select-account', 'Select Account', 1);

-- Insert Traditional Chinese translations (locale_id = 2)
INSERT INTO public.core_translation (id, key, value, locale_id) VALUES
(6720, 'demo-account', '示範帳戶', 2),
(6721, 'select-account', '選擇帳戶', 2);

-- Update sequence to reflect new ID
SELECT setval('public.core_translation_id_seq', 6721, true);

-- Verify the insertions
SELECT * FROM public.core_translation WHERE key IN ('demo-account', 'select-account') ORDER BY key, locale_id;
