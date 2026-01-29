# Process Functions - 進階查詢邏輯說明

## 概述

Process Functions 頁面提供進階查詢功能，允許用戶添加多個條件組來篩選資料。本文檔說明條件組之間以及條件值之間的邏輯關係。

## 核心邏輯

### 1. 條件組之間的關係：**AND（交集）**

多個條件組之間使用 **AND** 邏輯，即查詢結果必須同時滿足所有條件組。

#### 前端實現
- **位置**: `client/src/app/modules/admin/process-functions/process-functions.component.ts`
- **行數**: 115-118, 379-392, 540-577

用戶點擊「添加條件組」按鈕時，會調用 `addConditionGroup()` 方法：
```typescript
addConditionGroup(): void {
    this.conditions.push({
        selectedDataType: null,
        selectedDataParameter: null,
        selectedOperator: null,
        value: null
    });
}
```

所有條件組會存儲在 `conditions` 陣列中，並在查詢時一起發送到後端。

#### 後端實現
- **位置**: `backend/apps/forge/api/views.py`
- **行數**: 1283-1286

```python
if dbid_model_filters is None:
    dbid_model_filters = set(dbids)
else:
    dbid_model_filters &= set(dbids)  # 取交集 (AND operation)
```

**說明**：每處理一個條件組，就與現有結果取交集（`&=` 運算符），確保最終結果滿足所有條件。

---

### 2. 分號分隔的值：**OR（聯集）**

在單一條件組中，如果條件值為字串且包含分號（`;`），則分號分隔的多個值之間使用 **OR** 邏輯。

#### 適用運算符

##### a) 'eq' (等於) 運算符
- **位置**: `backend/apps/forge/api/views.py:1225-1232`

```python
if value and isinstance(value, str) and ';' in value:
    keywords = [keyword.strip() for keyword in value.split(';') if keyword.strip()]
    if keywords:
        q_objects = Q()
        for keyword in keywords:
            q_objects |= Q(value__exact=keyword)  # OR operation
        condition_filter &= q_objects
```

**說明**：將字串以分號分割，每個關鍵字使用 `|=` 建立 OR 條件。

##### b) 'contains' (包含) 運算符
- **位置**: `backend/apps/forge/api/views.py:1237-1247`

```python
if type_hint == 'string' and value:
    keywords = [keyword.strip() for keyword in value.split(';') if keyword.strip()]
    if keywords:
        q_objects = Q()
        for keyword in keywords:
            q_objects |= Q(value__contains=keyword)  # OR operation
        condition_filter &= q_objects
```

**說明**：同樣使用 OR 邏輯，但匹配方式為包含（contains）而非完全相等（exact）。

---

## 實際應用範例

### 範例 1：單一條件組

**查詢條件**：
- 條件組 1: `Name contains "Sensor;Monitor"`

**解釋**：
- 查詢 Name 欄位**包含** "Sensor" **或** "Monitor" 的資料

**SQL 等效**：
```sql
WHERE (value LIKE '%Sensor%' OR value LIKE '%Monitor%')
```

---

### 範例 2：多個條件組

**查詢條件**：
- 條件組 1: `Name contains "A;B"`
- 條件組 2: `Type equals "X;Y"`

**解釋**：
- 條件組 1: Name 包含 "A" **或** "B"
- 條件組 2: Type 等於 "X" **或** "Y"
- 兩個條件組之間為 **AND** 關係

**邏輯表達式**：
```
(Name包含A OR Name包含B) AND (Type等於X OR Type等於Y)
```

**SQL 等效**：
```sql
WHERE (value LIKE '%A%' OR value LIKE '%B%')
  AND (value = 'X' OR value = 'Y')
```

**結果**：只有同時滿足兩個條件組的資料會被返回。

---

### 範例 3：複雜查詢

**查詢條件**：
- 條件組 1: `Status equals "active;pending"`
- 條件組 2: `Temperature > 25`
- 條件組 3: `Location contains "Building A;Building B;Building C"`

**解釋**：
- Status 必須是 "active" 或 "pending"
- **且** Temperature 必須大於 25
- **且** Location 必須包含 "Building A" 或 "Building B" 或 "Building C"

**邏輯表達式**：
```
(Status=active OR Status=pending)
AND (Temperature>25)
AND (Location包含"Building A" OR Location包含"Building B" OR Location包含"Building C")
```

---

## 關鍵代碼位置總結

| 功能 | 檔案路徑 | 行數 | 說明 |
|------|---------|------|------|
| 條件組陣列定義 | `client/.../process-functions.component.ts` | 115-118 | `conditions: any[] = []` |
| 添加條件組 | `client/.../process-functions.component.ts` | 379-392 | `addConditionGroup()` 方法 |
| 發送查詢請求 | `client/.../process-functions.component.ts` | 540-577 | `loadPage()` 建立請求 |
| 後端條件組 AND | `backend/apps/forge/api/views.py` | 1283-1286 | 取交集邏輯 |
| 分號 OR (eq) | `backend/apps/forge/api/views.py` | 1225-1232 | 等於運算符 |
| 分號 OR (contains) | `backend/apps/forge/api/views.py` | 1237-1247 | 包含運算符 |

---

## 快速記憶

```
條件組之間 = AND（必須全部滿足）
分號分隔值 = OR（滿足任一即可）

公式：(條件1) AND (條件2) AND (條件3) AND ...
其中每個條件可能是：(值1 OR 值2 OR 值3 OR ...)
```

---

## 注意事項

1. **分號分隔僅適用於字串類型**：數值型別不支援分號分隔
2. **空白會被自動去除**：`"A; B ;C"` 會被處理為 `["A", "B", "C"]`
3. **條件組順序不影響結果**：因為使用 AND 邏輯，交集運算滿足交換律
4. **空條件會被忽略**：前端會過濾掉未完整填寫的條件組

---

## 擴展開發建議

如需修改查詢邏輯：

1. **改變條件組關係（AND → OR）**：
   - 修改 `backend/apps/forge/api/views.py:1286`
   - 將 `&=`（交集）改為 `|=`（聯集）

2. **改變分號邏輯（OR → AND）**：
   - 修改對應運算符的 Q 物件組合方式
   - 將 `|=` 改為 `&=`

3. **添加新的運算符**：
   - 在前端添加運算符選項
   - 在後端 `advanced()` 方法中添加對應處理邏輯

---

**文檔版本**: 1.0
**最後更新**: 2026-01-21
**維護者**: Development Team
