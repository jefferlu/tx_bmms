-- SQL Script to add translation keys for sensor-bindings feature
-- Generated on 2026-01-09
--
-- This script adds translations for the Sensor Bindings Management module
--
-- Note: Starting from ID 6722 (previous script ended at 6721)
--
-- Usage:
--   psql -U bmms -d your_database_name -f add_sensor_bindings_translations.sql

-- Insert English translations (locale_id = 1)
INSERT INTO public.core_translation (id, key, value, locale_id) VALUES
-- Page Header
(6722, 'sensor-binding-management', 'Sensor Binding Management', 1),
(6723, 'add-binding', 'Add Binding', 1),

-- Table Headers
(6724, 'element-db-id', 'Element DB ID', 1),
(6725, 'element-name', 'Element Name', 1),
(6726, 'position-type', 'Position Type', 1),

-- Status
(6727, 'active', 'Active', 1),
(6728, 'inactive', 'Inactive', 1),

-- Empty State
(6729, 'no-binding-data', 'No binding data', 1),
(6730, 'click-add-binding-description', 'Click "Add Binding" button to start creating bindings between sensors and BIM elements', 1),

-- Drawer Title
(6731, 'edit-binding', 'Edit Binding', 1),

-- Form Labels
(6732, 'model-urn', 'Model URN', 1),
(6733, 'element-external-id', 'Element External ID', 1),
(6734, 'position-offset-xyz', 'Position Offset (X, Y, Z)', 1),
(6735, 'icon-type', 'Icon Type', 1),
(6736, 'show-label', 'Show Label', 1),

-- Placeholders
(6737, 'enter-model-urn', 'Enter model URN', 1),
(6738, 'enter-element-db-id', 'Enter element DB ID', 1),
(6739, 'enter-element-name-optional', 'Enter element name (optional)', 1),
(6740, 'enter-element-external-id-optional', 'Enter element external ID (optional)', 1),
(6741, 'enter-icon-type-optional', 'Enter icon type (optional)', 1),
(6742, 'enter-color-optional', 'Enter color (optional)', 1),
(6743, 'enter-notes-optional', 'Enter notes (optional)', 1),

-- Validation Messages
(6744, 'please-select-sensor', 'Please select a sensor', 1),
(6745, 'please-enter-model-urn', 'Please enter model URN', 1),
(6746, 'please-enter-element-db-id', 'Please enter element DB ID', 1),
(6747, 'please-fill-required-fields', 'Please fill in required fields', 1),

-- Position Type Options
(6748, 'center', 'Center', 1),
(6749, 'top', 'Top', 1),
(6750, 'bottom', 'Bottom', 1),
(6751, 'custom', 'Custom', 1),

-- Toast Messages
(6752, 'failed-to-load-data', 'Failed to load data', 1),
(6753, 'binding-updated', 'Binding updated', 1),
(6754, 'failed-to-update-binding', 'Failed to update binding', 1),
(6755, 'binding-created', 'Binding created', 1),
(6756, 'failed-to-create-binding', 'Failed to create binding', 1),
(6757, 'binding-deleted', 'Binding deleted', 1),
(6758, 'failed-to-delete-binding', 'Failed to delete binding', 1),

-- Confirmation Dialog
(6759, 'confirm-delete-binding', 'Confirm Delete', 1),
(6760, 'confirm-delete-binding-message', 'Are you sure you want to delete this binding?', 1);

-- Insert Traditional Chinese translations (locale_id = 2)
INSERT INTO public.core_translation (id, key, value, locale_id) VALUES
-- Page Header
(6761, 'sensor-binding-management', '感測器綁定管理', 2),
(6762, 'add-binding', '新增綁定', 2),

-- Table Headers
(6763, 'element-db-id', '元件 DB ID', 2),
(6764, 'element-name', '元件名稱', 2),
(6765, 'position-type', '位置類型', 2),

-- Status
(6766, 'active', '啟用', 2),
(6767, 'inactive', '停用', 2),

-- Empty State
(6768, 'no-binding-data', '尚無綁定資料', 2),
(6769, 'click-add-binding-description', '點擊「新增綁定」按鈕開始建立感測器與 BIM 元件的綁定', 2),

-- Drawer Title
(6770, 'edit-binding', '編輯綁定', 2),

-- Form Labels
(6771, 'model-urn', '模型 URN', 2),
(6772, 'element-external-id', '元件外部 ID', 2),
(6773, 'position-offset-xyz', '位置偏移 (X, Y, Z)', 2),
(6774, 'icon-type', '圖示類型', 2),
(6775, 'show-label', '顯示標籤', 2),

-- Placeholders
(6776, 'enter-model-urn', '輸入模型 URN', 2),
(6777, 'enter-element-db-id', '輸入元件 DB ID', 2),
(6778, 'enter-element-name-optional', '輸入元件名稱 (選填)', 2),
(6779, 'enter-element-external-id-optional', '輸入元件外部 ID (選填)', 2),
(6780, 'enter-icon-type-optional', '輸入圖示類型 (選填)', 2),
(6781, 'enter-color-optional', '輸入顏色 (選填)', 2),
(6782, 'enter-notes-optional', '輸入備註 (選填)', 2),

-- Validation Messages
(6783, 'please-select-sensor', '請選擇感測器', 2),
(6784, 'please-enter-model-urn', '請輸入模型 URN', 2),
(6785, 'please-enter-element-db-id', '請輸入元件 DB ID', 2),
(6786, 'please-fill-required-fields', '請填寫必填欄位', 2),

-- Position Type Options
(6787, 'center', '中心', 2),
(6788, 'top', '頂部', 2),
(6789, 'bottom', '底部', 2),
(6790, 'custom', '自訂', 2),

-- Toast Messages
(6791, 'failed-to-load-data', '載入資料失敗', 2),
(6792, 'binding-updated', '綁定已更新', 2),
(6793, 'failed-to-update-binding', '更新綁定失敗', 2),
(6794, 'binding-created', '綁定已建立', 2),
(6795, 'failed-to-create-binding', '建立綁定失敗', 2),
(6796, 'binding-deleted', '綁定已刪除', 2),
(6797, 'failed-to-delete-binding', '刪除綁定失敗', 2),

-- Confirmation Dialog
(6798, 'confirm-delete-binding', '確認刪除', 2),
(6799, 'confirm-delete-binding-message', '確定要刪除此綁定嗎？', 2);

-- Update sequence to reflect new ID
SELECT setval('public.core_translation_id_seq', 6799, true);

-- Verify the insertions
SELECT COUNT(*) as total_records
FROM public.core_translation
WHERE id BETWEEN 6722 AND 6799;

SELECT key, value, locale_id
FROM public.core_translation
WHERE key LIKE '%binding%' OR key LIKE '%sensor%'
ORDER BY key, locale_id;
