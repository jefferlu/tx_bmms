# Migration Guide: OneToOneField 實施指南

## 已完成的後端修改

### 1. Models 修改 (`backend/apps/sensors/models.py`)
✅ 將 `SensorBimBinding.sensor` 從 `ForeignKey` 改為 `OneToOneField`
✅ 修改 `related_name` 從 `'bim_bindings'` (複數) 改為 `'bim_binding'` (單數)
✅ 移除 `unique_together` 約束（OneToOneField 已確保唯一性）

### 2. ViewSet 修改 (`backend/apps/sensors/views.py`)
✅ 新增 `SensorBimBindingViewSet.create()` 方法
   - 創建綁定前自動檢查並刪除既有綁定
   - 使用 `transaction.atomic()` 確保原子性操作

✅ 修改 `SensorViewSet.bindings()` 方法
   - 從 `sensor.bim_bindings.filter()` 改為 `sensor.bim_binding`
   - 處理 `SensorBimBinding.DoesNotExist` 異常

### 3. Serializer 修改 (`backend/apps/sensors/serializers.py`)
✅ 修改 `SensorSerializer.get_bim_bindings_count()` 方法
   - 從 `obj.bim_bindings.filter().count()` 改為檢查單一綁定
   - OneToOneField 只會返回 0 或 1

---

## 資料庫遷移步驟

### 步驟 1: 清理重複綁定（執行遷移前必須做）

```bash
# 進入 Docker 容器
docker exec -it bmms_backend bash

# 進入 Django shell
python manage.py shell
```

```python
# 在 Django shell 中執行
from apps.sensors.models import SensorBimBinding
from django.db.models import Count

# 找出有多個綁定的 sensor
duplicates = (
    SensorBimBinding.objects
    .values('sensor')
    .annotate(count=Count('id'))
    .filter(count__gt=1)
)

print(f"發現 {len(duplicates)} 個 sensor 有多個綁定")

# 清理重複綁定，保留最新的
for dup in duplicates:
    sensor_id = dup['sensor']
    bindings = SensorBimBinding.objects.filter(sensor_id=sensor_id).order_by('-created_at')

    # 保留第一個（最新的），刪除其他的
    keep_binding = bindings.first()
    delete_count = bindings.exclude(id=keep_binding.id).count()

    print(f"Sensor {sensor_id}: 保留綁定 {keep_binding.id}, 刪除 {delete_count} 個舊綁定")
    bindings.exclude(id=keep_binding.id).delete()

print("清理完成！")
```

### 步驟 2: 生成並執行遷移

```bash
# 在 Docker 容器內執行
python manage.py makemigrations sensors

# 檢查遷移檔案
python manage.py showmigrations sensors

# 執行遷移
python manage.py migrate sensors
```

### 步驟 3: 驗證遷移結果

```bash
# 進入 Django shell
python manage.py shell
```

```python
from apps.sensors.models import Sensor, SensorBimBinding

# 測試 1: 檢查 OneToOneField
sensor = Sensor.objects.first()
try:
    binding = sensor.bim_binding  # 應該是單數，不是 bim_bindings
    print(f"✅ OneToOneField 正常: {binding}")
except Exception as e:
    print(f"❌ 錯誤: {e}")

# 測試 2: 嘗試創建重複綁定（應該失敗）
try:
    # 假設 sensor_id=1 已有綁定
    SensorBimBinding.objects.create(
        sensor_id=1,
        model_urn='test',
        element_dbid=999
    )
    print("❌ 錯誤: 允許創建重複綁定")
except Exception as e:
    print(f"✅ 正確: 阻止重複綁定 - {e}")
```

---

## 手動 SQL 遷移（如果 Django 遷移失敗）

如果自動遷移有問題，可以手動執行以下 SQL：

```sql
-- 1. 先找出並記錄要刪除的重複綁定
SELECT
    sensor_id,
    COUNT(*) as binding_count,
    array_agg(id ORDER BY created_at DESC) as binding_ids
FROM sensor_bim_bindings
GROUP BY sensor_id
HAVING COUNT(*) > 1;

-- 2. 刪除重複綁定（保留最新的）
DELETE FROM sensor_bim_bindings
WHERE id IN (
    SELECT UNNEST(binding_ids[2:]) as id_to_delete
    FROM (
        SELECT
            sensor_id,
            array_agg(id ORDER BY created_at DESC) as binding_ids
        FROM sensor_bim_bindings
        GROUP BY sensor_id
        HAVING COUNT(*) > 1
    ) duplicates
);

-- 3. 檢查是否還有重複
SELECT sensor_id, COUNT(*)
FROM sensor_bim_bindings
GROUP BY sensor_id
HAVING COUNT(*) > 1;
-- 應該返回 0 行

-- 4. 添加唯一約束
ALTER TABLE sensor_bim_bindings
ADD CONSTRAINT unique_sensor_binding UNIQUE (sensor_id);

-- 5. 驗證約束
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'sensor_bim_bindings'
    AND tc.constraint_type = 'UNIQUE';
```

---

## 測試 API

### 測試 1: 創建綁定（無既有綁定）

```bash
curl -X POST http://localhost:8100/api/sensors/bim-bindings/ \
  -H "Content-Type: application/json" \
  -d '{
    "sensor": 1,
    "model_urn": "urn:dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6dGVzdA",
    "element_dbid": 100,
    "element_name": "測試元件"
  }'
```

**預期結果**: 201 Created

### 測試 2: 創建重複綁定（應自動替換）

```bash
# 再次對同一個 sensor 創建綁定
curl -X POST http://localhost:8100/api/sensors/bim-bindings/ \
  -H "Content-Type: application/json" \
  -d '{
    "sensor": 1,
    "model_urn": "urn:different",
    "element_dbid": 200,
    "element_name": "新元件"
  }'
```

**預期結果**:
- 201 Created
- 舊綁定自動被刪除
- 只保留新綁定

### 測試 3: 查詢 Sensor 的綁定

```bash
curl http://localhost:8100/api/sensors/1/bindings/
```

**預期結果**:
- 返回單一綁定物件（不是陣列）
- 或返回 `null`（如果沒有綁定）

---

## 前端配合修改

前端已完成以下修改（`iot-extension.ts`）:

✅ 綁定前檢查 sensor 是否已有綁定
✅ 如已綁定，顯示確認對話框
✅ 用戶確認後，先刪除舊綁定再創建新綁定
✅ 如未綁定，直接創建新綁定

---

## 回滾步驟（如果需要）

如果遷移後出現問題，可以回滾：

```bash
# 查看遷移歷史
python manage.py showmigrations sensors

# 回滾到上一個遷移
python manage.py migrate sensors <上一個遷移編號>

# 手動移除唯一約束（SQL）
ALTER TABLE sensor_bim_bindings
DROP CONSTRAINT IF EXISTS unique_sensor_binding;
```

---

## 注意事項

1. ⚠️ **遷移前務必備份資料庫**
2. ⚠️ **在測試環境先執行一次完整流程**
3. ⚠️ **清理重複綁定是必須步驟，否則遷移會失敗**
4. ✅ 遷移完成後，一個 sensor 只能有一個綁定
5. ✅ ViewSet 會自動處理重複綁定（刪除舊的，創建新的）

---

## 執行 Checklist

- [ ] 備份資料庫
- [ ] 進入 Docker 容器
- [ ] 執行步驟 1: 清理重複綁定
- [ ] 執行步驟 2: 生成並執行遷移
- [ ] 執行步驟 3: 驗證遷移結果
- [ ] 測試 API（測試 1, 2, 3）
- [ ] 測試前端綁定功能
- [ ] 監控錯誤日誌

---

如有任何問題，請查看 Django 日誌或聯繫開發團隊。
