# 後端修改建議：確保一個 Sensor 只能綁定一個元件

## 業務邏輯說明
- **現況**：目前表結構允許同一個 sensor 綁定到多個不同的元件
- **問題**：實務上不合理，一個實體感測器不可能同時在兩個位置
- **需求**：確保一個 sensor 只能綁定到一個元件（一對一關係）

---

## 方案一：數據庫層面添加唯一約束（推薦）

### Django Models 修改

在 `SensorBimBinding` 模型中，為 `sensor` 欄位添加唯一約束：

```python
# server/apps/sensors/models.py

class SensorBimBinding(models.Model):
    """感測器與 BIM 元件的綁定關係"""

    # 將 sensor 改為 OneToOneField，確保一對一關係
    sensor = models.OneToOneField(
        'Sensor',
        on_delete=models.CASCADE,
        related_name='bim_binding',
        verbose_name='感測器',
        unique=True  # 確保唯一性
    )

    # ... 其他欄位保持不變
    model_urn = models.CharField(max_length=500, verbose_name='模型 URN')
    element_dbid = models.IntegerField(verbose_name='元件 DB ID')
    element_external_id = models.CharField(max_length=200, blank=True, null=True)
    element_name = models.CharField(max_length=200, blank=True, null=True)

    # ... 其他欄位

    class Meta:
        verbose_name = 'BIM 元件綁定'
        verbose_name_plural = 'BIM 元件綁定'
        # 如果使用 ForeignKey 而不是 OneToOneField，可以這樣添加約束
        # constraints = [
        #     models.UniqueConstraint(fields=['sensor'], name='unique_sensor_binding')
        # ]
```

### 遷移文件

生成並執行遷移：

```bash
# 1. 創建遷移文件
python manage.py makemigrations sensors

# 2. 執行遷移前，先清理重複數據
python manage.py shell
```

```python
# 在 Django shell 中清理重複綁定
from apps.sensors.models import SensorBimBinding
from django.db.models import Count

# 找出有多個綁定的 sensor
duplicates = (
    SensorBimBinding.objects
    .values('sensor')
    .annotate(count=Count('id'))
    .filter(count__gt=1)
)

for dup in duplicates:
    sensor_id = dup['sensor']
    bindings = SensorBimBinding.objects.filter(sensor_id=sensor_id).order_by('-id')

    # 保留最新的綁定，刪除其他的
    print(f"Sensor {sensor_id} 有 {dup['count']} 個綁定，保留最新的，刪除舊的...")
    bindings.exclude(id=bindings.first().id).delete()
```

```bash
# 3. 執行遷移
python manage.py migrate sensors
```

---

## 方案二：API 層面邏輯控制

### ViewSet 修改

在創建綁定時檢查並處理既有綁定：

```python
# server/apps/sensors/views.py

from rest_framework import viewsets, status
from rest_framework.response import Response
from django.db import transaction

class SensorBimBindingViewSet(viewsets.ModelViewSet):
    queryset = SensorBimBinding.objects.all()
    serializer_class = SensorBimBindingSerializer

    def create(self, request, *args, **kwargs):
        """創建綁定，如果 sensor 已有綁定則自動替換"""

        sensor_id = request.data.get('sensor')

        if not sensor_id:
            return Response(
                {'error': '缺少 sensor 參數'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 使用事務確保原子性操作
        with transaction.atomic():
            # 檢查該 sensor 是否已有綁定
            existing_binding = SensorBimBinding.objects.filter(
                sensor_id=sensor_id
            ).first()

            if existing_binding:
                # 方案 A：自動刪除舊綁定，創建新綁定
                existing_binding.delete()

                # 或方案 B：返回錯誤，讓前端處理
                # return Response(
                #     {
                #         'error': 'sensor_already_bound',
                #         'message': f'感測器已綁定至元件 {existing_binding.element_name}',
                #         'existing_binding': {
                #             'id': existing_binding.id,
                #             'element_name': existing_binding.element_name,
                #             'element_dbid': existing_binding.element_dbid,
                #         }
                #     },
                #     status=status.HTTP_409_CONFLICT
                # )

            # 創建新綁定
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)

            headers = self.get_success_headers(serializer.data)
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED,
                headers=headers
            )
```

---

## 方案三：數據庫觸發器（適用於多種框架）

如果需要在數據庫層面強制執行：

```sql
-- PostgreSQL 觸發器示例
CREATE OR REPLACE FUNCTION check_sensor_binding()
RETURNS TRIGGER AS $$
BEGIN
    -- 檢查該 sensor 是否已有其他綁定
    IF EXISTS (
        SELECT 1
        FROM sensor_bim_bindings
        WHERE sensor_id = NEW.sensor_id
          AND id != NEW.id
    ) THEN
        RAISE EXCEPTION 'Sensor % already has a binding', NEW.sensor_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_single_sensor_binding
BEFORE INSERT OR UPDATE ON sensor_bim_bindings
FOR EACH ROW
EXECUTE FUNCTION check_sensor_binding();
```

---

## 推薦實施步驟

1. **先實施方案二（API 層面）**
   - 立即生效，無需遷移
   - 前端已經實現相應邏輯
   - 提供更好的用戶體驗（確認對話框）

2. **再實施方案一（數據庫約束）**
   - 清理既有重複數據
   - 添加唯一約束或改為 OneToOneField
   - 執行遷移
   - 防止未來數據不一致

3. **可選：方案三（觸發器）**
   - 作為額外的安全保障
   - 防止直接數據庫操作造成的數據不一致

---

## 測試建議

### 1. 單元測試

```python
# server/apps/sensors/tests.py

from django.test import TestCase
from apps.sensors.models import Sensor, SensorBimBinding

class SensorBindingTestCase(TestCase):
    def setUp(self):
        self.sensor = Sensor.objects.create(
            sensor_id='TEMP-001',
            name='溫度感測器-01',
            sensor_type='temperature'
        )

    def test_sensor_can_only_have_one_binding(self):
        """測試一個 sensor 只能有一個綁定"""

        # 創建第一個綁定
        binding1 = SensorBimBinding.objects.create(
            sensor=self.sensor,
            model_urn='urn:model:1',
            element_dbid=100,
            element_name='元件-A'
        )

        # 嘗試創建第二個綁定（應該失敗或替換第一個）
        with self.assertRaises(Exception):
            binding2 = SensorBimBinding.objects.create(
                sensor=self.sensor,
                model_urn='urn:model:2',
                element_dbid=200,
                element_name='元件-B'
            )
```

### 2. API 測試

```python
def test_create_duplicate_binding_returns_conflict(self):
    """測試創建重複綁定時的行為"""

    # 創建第一個綁定
    response1 = self.client.post('/api/bindings/', {
        'sensor': self.sensor.id,
        'model_urn': 'urn:model:1',
        'element_dbid': 100,
    })
    self.assertEqual(response1.status_code, 201)

    # 嘗試創建第二個綁定
    response2 = self.client.post('/api/bindings/', {
        'sensor': self.sensor.id,
        'model_urn': 'urn:model:2',
        'element_dbid': 200,
    })

    # 根據實施方案，可能返回 409 Conflict 或 201 Created（替換）
    self.assertIn(response2.status_code, [201, 409])
```

---

## 前端已實現的功能

✅ 綁定前檢查 sensor 是否已有綁定
✅ 如已綁定，顯示確認對話框
✅ 用戶確認後，先刪除舊綁定再創建新綁定
✅ 如未綁定，直接創建新綁定

**前端代碼位置**：`client/src/app/layout/common/aps-viewer/extensions/iot/iot-extension.ts`

---

## 注意事項

1. **數據遷移前備份**：執行遷移前務必備份數據庫
2. **清理既有數據**：添加唯一約束前必須清理重複數據
3. **前後端協調**：確保前端和後端的邏輯一致
4. **用戶通知**：如果系統已在使用，需要通知用戶此變更

---

## 聯絡

如有任何問題或需要協助實施，請聯繫開發團隊。
