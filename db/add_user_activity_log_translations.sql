-- SQL Script to add translations for user-activity-log component
-- Last translation ID: 6799
-- New translations start from ID: 6800

-- Insert English translations (locale_id = 1)
INSERT INTO public.core_translation (id, key, value, locale_id) VALUES
(6800, 'user-activity-log', 'User Activity Log', 1),
(6801, 'search', 'Search', 1),
(6802, 'download', 'Download', 1),
(6803, 'download-csv', 'Download CSV', 1),
(6804, 'download-txt', 'Download TXT', 1),
(6805, 'account', 'Account', 1),
(6806, 'function-name', 'Function Name', 1),
(6807, 'action', 'Action', 1),
(6808, 'status', 'Status', 1),
(6809, 'timestamp', 'Timestamp', 1),
(6810, 'ip-address', 'IP Address', 1),
(6811, 'no-data-found', 'No data found', 1);

-- Insert Chinese translations (locale_id = 2)
INSERT INTO public.core_translation (id, key, value, locale_id) VALUES
(6812, 'user-activity-log', '使用者活動記錄', 2),
(6813, 'search', '搜尋', 2),
(6814, 'download', '下載', 2),
(6815, 'download-csv', '下載 CSV', 2),
(6816, 'download-txt', '下載 TXT', 2),
(6817, 'account', '帳號', 2),
(6818, 'function-name', '功能名稱', 2),
(6819, 'action', '動作', 2),
(6820, 'status', '狀態', 2),
(6821, 'timestamp', '時間戳記', 2),
(6822, 'ip-address', 'IP 位址', 2),
(6823, 'no-data-found', '查無資料', 2);

-- Update sequence to reflect new ID
SELECT setval('public.core_translation_id_seq', 6823, true);

-- Verify the insertions
SELECT COUNT(*) as total_records
FROM public.core_translation
WHERE id BETWEEN 6800 AND 6823;

SELECT key, value, locale_id
FROM public.core_translation
WHERE key IN ('user-activity-log', 'search', 'download', 'download-csv', 'download-txt', 'account',
              'function-name', 'action', 'status', 'timestamp', 'ip-address', 'no-data-found')
ORDER BY key, locale_id;
