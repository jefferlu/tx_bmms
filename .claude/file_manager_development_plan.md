# 自定義檔案管理系統開發計劃
## Angular Fuse + Django REST Framework 整合

---

## 1. 項目概述

### 1.1 目標
開發一個整合於 Fuse Angular 模板中的現代化檔案管理員，以取代過時的 elFinder PHP 套件。權限管理完全由 Django 後端控制，前端 UI 使用 Angular Material 與 PrimeNG 構建。

### 1.2 核心需求
- 移除 PHP 依賴，所有權限邏輯移至 Django 後端
- 全局的讀取 (read) / 寫入 (write) 權限控制，不需精確到特定目錄
- 寫入權限涵蓋：上傳、刪除、重新命名、移動、建立資料夾
- 前端完全由後端權限決定 UI 展示
- 使用 Django REST Framework 提供 API

### 1.3 技術棧

**前端：**
- Angular （與 Fuse 模板版本一致）
- Angular Material
- PrimeNG
- Tailwind CSS
- TypeScript

**後端：**
- Django
- Django REST Framework (DRF)
- Python

**檔案存儲：**
- Django MEDIA_ROOT 下的專用目錄

---

## 2. 架構設計

### 2.1 系統架構圖描述
```
┌─────────────────┐
│   Angular APP   │
│  (File Manager) │
└────────┬────────┘
         │ HTTP REST API
         ▼
┌──────────────────────────────┐
│   Django REST Framework      │
│  - Permissions Layer         │
│  - File Operations Logic     │
│  - Path Validation           │
│  - Security Checks           │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│   File System               │
│  MEDIA_ROOT/storage/        │
└──────────────────────────────┘
```

### 2.2 權限模型
- 使用 Django Permission 系統
- 定義兩個核心權限：
  - `app.view_files`：檢視檔案與資料夾
  - `app.edit_files`：上傳、刪除、重新命名、移動、建立資料夾
- 權限不精確到目錄級別，而是全局級別
- 前端根據後端回傳的權限狀態動態渲染 UI

### 2.3 資料流
1. 前端發送請求（含認證令牌）
2. Django 驗證使用者身份與權限
3. 執行檔案操作（若有權限）
4. 返回結果或錯誤訊息
5. 前端根據回應更新 UI

---

## 3. 後端開發任務 (Django REST Framework)

### 階段 A：基礎設施與安全性

#### A1. 檔案系統結構規範

- 在 `MEDIA_ROOT` 下建立專用的檔案管理根目錄，命名為 `storage/`
- 確保 Django 應用具備該目錄的完整讀寫權限
- 檔案系統結構如下：
  ```
  MEDIA_ROOT/
  ├── storage/
  │   ├── user_uploads/
  │   ├── shared_documents/
  │   └── temp/
  └── other_media/
  ```

#### A2. 安全性防護機制

**路徑校驗邏輯 (Path Validation)：**
- 實作路徑正規化函數，將所有相對路徑轉換為絕對路徑
- 使用 `pathlib.Path.resolve()` 確保路徑解析
- 驗證解析後的路徑確實位於根目錄 (storage/) 內
- 防止「路徑遍歷攻擊」(Path Traversal)，阻止 `../` 等惡意路徑

**副檔名黑名單檢查：**
- 上傳時檢查副檔名
- 禁止上傳的副檔名列表：`.php`, `.exe`, `.sh`, `.bat`, `.com`, `.pif`, `.scr`, `.asp`, `.aspx`, `.jsp`
- 可根據業務需求動態配置黑名單

**檔案類型驗證：**
- 驗證上傳檔案的 MIME 類型（不單純依賴副檔名）
- 檢查檔案內容頭部 (magic bytes) 確認真實類型

#### A3. 日誌與監審

- 記錄所有檔案操作（上傳、刪除、重新命名、移動）
- 包含操作者、操作類型、目標路徑、時間戳
- 用於安全審查和故障排查

---

### 階段 B：Django 應用配置

#### B1. Django 應用設置

- 在 `settings.py` 中配置檔案管理相關常數：
  - `STORAGE_ROOT`：檔案管理根目錄
  - `ALLOWED_FILE_EXTENSIONS`：允許的副檔名列表
  - `MAX_FILE_SIZE`：單個檔案大小限制
  - `MAX_UPLOAD_SIZE`：單次上傳總大小限制

#### B2. 權限定義

- 在應用的 `models.py` 或 `apps.py` 中定義或確認 Django permissions
- 定義權限：
  - `view_files` (檔案管理-檢視)
  - `edit_files` (檔案管理-編輯)

---

### 階段 C：API 實作

#### C1. 權限類 (Permission Class)

建立自定義的 DRF Permission 類 `FileBrowserPermission`：

**讀取權限檢查：**
- 驗證使用者是否擁有 `app.view_files` 權限
- GET 請求需要此權限

**寫入權限檢查：**
- 驗證使用者是否擁有 `app.edit_files` 權限
- POST / DELETE / PUT / PATCH 請求需要此權限
- 涵蓋範圍：上傳、刪除、重新命名、移動、建立資料夾

**權限檢查時機：**
- Serializer 級別：驗證輸入
- View 級別：檢查請求權限

#### C2. 核心端點設計

**端點 1：列表 / 檢視**
- **URL：** `GET /api/file-manager/list/`
- **參數：** `path` (query parameter，相對於 storage/ 根目錄的路徑)
- **權限要求：** `view_files`
- **功能：**
  - 接收相對路徑，返回該目錄下的檔案與資料夾列表
  - 回傳欄位：名稱、大小、修改時間、類型 (file/directory)、檔案圖示/預縮圖、建立時間
  - 支援分頁 (可選)
  - 支援排序 (名稱、大小、修改時間)
- **回應格式 (JSON)：**
  ```json
  {
    "current_path": "docs/",
    "items": [
      {
        "name": "report.pdf",
        "type": "file",
        "size": 1024000,
        "modified_time": "2025-01-08T10:30:00Z",
        "created_time": "2025-01-01T10:30:00Z",
        "is_writable": true
      },
      {
        "name": "projects",
        "type": "directory",
        "size": null,
        "modified_time": "2025-01-05T14:20:00Z",
        "created_time": "2024-12-20T09:00:00Z",
        "is_writable": true
      }
    ],
    "permissions": {
      "can_read": true,
      "can_write": true
    }
  }
  ```
- **錯誤處理：**
  - 路徑不存在：404
  - 無讀取權限：403
  - 非法路徑 (路徑遍歷)：400

**端點 2：上傳檔案**
- **URL：** `POST /api/file-manager/upload/`
- **參數：** 
  - `path` (form field，目標目錄)
  - `file` (file field，單個或多個檔案)
- **權限要求：** `edit_files`
- **功能：**
  - 處理單個或多個檔案上傳
  - 驗證檔案副檔名與大小
  - 避免檔案名衝突（可自動重新命名或返回錯誤）
  - 存儲檔案至指定目錄
- **回應格式 (JSON)：**
  ```json
  {
    "success": true,
    "uploaded_files": [
      {
        "name": "document.pdf",
        "path": "docs/document.pdf",
        "size": 512000,
        "message": "File uploaded successfully"
      }
    ],
    "failed_files": [
      {
        "name": "script.php",
        "message": "File extension not allowed"
      }
    ]
  }
  ```
- **錯誤處理：**
  - 無寫入權限：403
  - 副檔名不允許：400
  - 檔案過大：413

**端點 3：執行操作（重新命名、刪除、移動、建立資料夾）**
- **URL：** `POST /api/file-manager/action/`
- **參數：** JSON 請求體
  ```json
  {
    "action": "rename|delete|move|mkdir",
    "path": "docs/old_name.txt",
    "new_path": "docs/new_name.txt",
    "new_name": "new_name.txt"
  }
  ```
- **權限要求：** `edit_files`
- **功能：**
  - `rename`：重新命名檔案或資料夾
  - `delete`：刪除檔案或資料夾（包含內容）
  - `move`：移動檔案或資料夾至新位置
  - `mkdir`：建立新資料夾
- **回應格式 (JSON)：**
  ```json
  {
    "success": true,
    "action": "rename",
    "message": "File renamed successfully",
    "item": {
      "name": "new_name.txt",
      "path": "docs/new_name.txt",
      "type": "file"
    }
  }
  ```
- **錯誤處理：**
  - 無寫入權限：403
  - 目標已存在：409
  - 路徑不存在：404
  - 非法路徑：400

**端點 4：下載檔案**
- **URL：** `GET /api/file-manager/download/`
- **參數：** `path` (query parameter)
- **權限要求：** `view_files`
- **功能：**
  - 以檔案流形式返回檔案內容
  - 設定正確的 Content-Type 與 Content-Disposition
- **回應格式：**
  - Binary 檔案流，附加適當的 HTTP Headers
  ```
  Content-Type: application/octet-stream
  Content-Disposition: attachment; filename="example.pdf"
  ```
- **錯誤處理：**
  - 無讀取權限：403
  - 檔案不存在：404
  - 請求路徑是資料夾：400

#### C3. Serializers 設計

- 建立 `FileItemSerializer`：序列化檔案與資料夾物件
  - 欄位：name, type, size, modified_time, created_time, path, is_writable
- 建立 `UploadResponseSerializer`：序列化上傳結果
- 建立 `ActionRequestSerializer`：驗證操作請求的輸入
- 建立 `PermissionResponseSerializer`：序列化權限資訊

#### C4. Views 實作

- 建立 `FileBrowserListView` (APIView 或 ViewSet)：處理列表與下載
- 建立 `FileUploadView` (APIView 或 ViewSet)：處理檔案上傳
- 建立 `FileActionView` (APIView 或 ViewSet)：處理檔案操作
- 每個 View 均應：
  - 檢查權限（使用 `permission_classes`）
  - 驗證輸入參數
  - 執行路徑安全檢查
  - 記錄操作日誌
  - 返回適當的 HTTP 狀態碼與訊息

#### C5. URL 路由配置

- 在 `urls.py` 中配置路由：
  ```
  /api/file-manager/list/        (GET)
  /api/file-manager/upload/      (POST)
  /api/file-manager/action/      (POST)
  /api/file-manager/download/    (GET)
  /api/file-manager/permissions/ (GET, 可選)
  ```

#### C6. 錯誤處理與異常管理

- 建立自定義異常類：
  - `FilePathTraversalError`：路徑遍歷攻擊
  - `FileNotAllowedError`：副檔名或 MIME 類型不允許
  - `FileSizeExceededError`：檔案大小超限
  - `FileAlreadyExistsError`：檔案已存在
- 設定全域異常處理器，返回 JSON 格式的錯誤訊息

---

## 4. 前端開發任務 (Angular / Fuse)

### 階段 D：資料服務層

#### D1. 檔案服務 (FileService)

建立 `file-manager.service.ts`：

**核心功能：**
- 使用 `HttpClient` 封裝後端 API 呼叫
- 定義 TypeScript interfaces 與 types，匹配後端 JSON 結構
- 實作狀態管理，追蹤：
  - 當前路徑 (`currentPath$` - BehaviorSubject)
  - 檔案清單 (`files$` - BehaviorSubject)
  - 使用者權限 (`permissions$` - BehaviorSubject)
  - 加載狀態 (`loading$` - BehaviorSubject)
  - 錯誤訊息 (`error$` - BehaviorSubject)

**主要方法：**
- `listFiles(path: string): Observable<FileListResponse>`
- `uploadFiles(path: string, files: File[]): Observable<UploadResponse>`
- `deleteItem(path: string): Observable<ActionResponse>`
- `renameItem(oldPath: string, newName: string): Observable<ActionResponse>`
- `moveItem(sourcePath: string, destPath: string): Observable<ActionResponse>`
- `createFolder(path: string, folderName: string): Observable<ActionResponse>`
- `downloadFile(path: string): void`
- `getPermissions(): Observable<PermissionResponse>`

**狀態管理方法：**
- `navigateTo(path: string): void` - 更新當前路徑並重新加載檔案
- `goBack(): void` - 返回上層目錄
- `goToRoot(): void` - 返回根目錄

**錯誤處理：**
- 攔截 HTTP 錯誤，轉換為使用者友善的訊息
- 區分 403 (無權限) 與其他錯誤

#### D2. TypeScript Interfaces 定義

- `FileItem`：代表單個檔案或資料夾
- `FileListResponse`：列表端點的回應
- `UploadResponse`：上傳端點的回應
- `ActionResponse`：操作端點的回應
- `PermissionInfo`：使用者權限資訊

---

### 階段 E：UI 組件開發

#### E1. 佈局整合與結構

**頁面結構概述：**
- Header 區域：麵包屑導航、搜尋欄 (可選)、操作按鈕
- Sidebar 區域 (可選)：資料夾樹狀結構，使用 PrimeNG p-tree
- Main 區域：檔案列表
- Context Menu：右鍵操作選單

**Fuse 模板整合：**
- 延用 Fuse 的檔案管理頁面架構
- 保持 Fuse 的視覺風格與佈局邏輯

#### E2. 主要視圖與組件

**E2.1 麵包屑導航 (Breadcrumbs)**
- 顯示當前路徑階層
- 支援點擊導航至任意上層目錄
- 使用 Angular Material 或 PrimeNG breadcrumb 組件

**E2.2 檔案列表檢視**
- 使用 Angular Material `MatTable` 顯示檔案與資料夾
- 或使用 PrimeNG `p-dataTable` / `p-table`
- 或使用 PrimeNG `p-virtualScroller` 以支援大量檔案
- 列欄位：
  - 圖示 (檔案類型/資料夾圖標)
  - 名稱
  - 修改時間
  - 大小
  - (可選) 建立時間
- 功能：
  - 雙擊進入資料夾
  - 單擊選擇檔案 (支援多選，Shift+Click, Ctrl+Click)
  - 排序 (點擊欄標題)
  - 分頁 (若有) 或虛擬滾動

**E2.3 檔案夾樹狀導航 (可選)**
- 使用 PrimeNG `p-tree` 組件
- 展示資料夾結構
- 支援展開/收合
- 點擊直接導航至該資料夾
- 延遲加載 (LazyLoading) 以提升效能

**E2.4 路徑位置欄**
- 顯示當前目錄的完整路徑
- 支援手動編輯路徑 (可選)

#### E3. 使用者互動與操作

**E3.1 上傳功能**
- 整合 PrimeNG `p-fileUpload` 組件
- 支援：
  - 點擊選擇檔案
  - 拖拽上傳 (Drag & Drop)
  - 多檔案選擇
  - 上傳進度條 (顯示百分比)
  - 上傳成功/失敗提示
- 驗證：
  - 檔案大小限制提示
  - 副檔名檢查 (前端可進行基礎檢查)
  - 上傳前顯示確認對話框

**E3.2 右鍵選單 (Context Menu)**
- 整合 PrimeNG `p-contextMenu`
- 操作項目：
  - 重新命名 (若有寫入權限)
  - 刪除 (若有寫入權限)
  - 複製 (可選)
  - 移動到 (可選，可選擇目標目錄)
  - 下載 (檔案) / 下載為 ZIP (資料夾，可選)
  - 詳細資訊 (檔案屬性)
- 禁用無權限的操作

**E3.3 建立資料夾**
- 按鈕或右鍵選單選項
- 彈出對話框要求輸入資料夾名稱
- 驗證輸入 (無空白、特殊字元等)
- 需要寫入權限

**E3.4 重新命名檔案**
- 右鍵選單或雙擊名稱進入編輯模式
- 彈出對話框或行內編輯
- 驗證新名稱有效性
- 需要寫入權限

**E3.5 刪除檔案**
- 右鍵選單選項
- 彈出確認對話框 (使用 PrimeNG `p-confirmDialog`)
- 顯示刪除對象資訊
- 刪除後更新列表
- 需要寫入權限

**E3.6 下載檔案**
- 右鍵選單或快捷按鈕
- 僅檔案可下載 (資料夾可選實作)
- 需要讀取權限

**E3.7 移動檔案**
- 可選實作
- 支援拖拽至新位置，或右鍵選單「移動到」
- 需要寫入權限

#### E4. 權限響應與 UI 隱藏/禁用

**權限檢查流程：**
1. 初始化時從後端獲取使用者權限 (`getPermissions()`)
2. 訂閱 `permissions$` Observable
3. 根據權限值動態渲染 UI

**UI 元素應用：**
- 上傳按鈕：`*ngIf="permissions.can_write"`
- 建立資料夾按鈕：`*ngIf="permissions.can_write"`
- 右鍵選單刪除/重新命名項：`[disabled]="!permissions.can_write"`
- 檔案表格：若無讀取權限，顯示「無權限」訊息

**使用者體驗：**
- 無權限操作時，在按鈕上顯示 tooltip 說明
- 嘗試無權限操作時，後端返回 403，前端顯示 Toast 提醒

#### E5. 加載與錯誤狀態

**加載狀態：**
- 訂閱 `loading$` Observable
- 顯示 Loading Spinner (使用 Angular Material `mat-spinner` 或 PrimeNG `p-progressSpinner`)
- 禁用操作按鈕

**錯誤狀態：**
- 訂閱 `error$` Observable
- 顯示錯誤訊息 Toast (使用 Fuse 或 PrimeNG `p-toast`)
- 根據錯誤類型顯示不同訊息：
  - 「無權限存取」(403)
  - 「檔案不存在」(404)
  - 「服務暫時無法使用」(5xx)
  - 「檔案上傳失敗」

#### E6. 響應式設計

- 支援桌面、平板、手機屏幕
- 使用 Tailwind CSS 實作響應式佈局
- 手機上隱藏非必要的欄 (如建立時間)
- 側邊欄在小屏幕上可收摺

---

## 5. 整合與權限管理

### 5.1 全域權限控制

**Django 為唯一真相來源 (Single Source of Truth)：**
- 所有權限決定由後端完成
- 前端只是權限的視覺表現

**初始化流程：**
1. 使用者登入
2. 進入檔案管理頁面
3. 前端呼叫 `getPermissions()` API
4. 後端檢查使用者權限，回傳 `{can_read: bool, can_write: bool}`
5. 前端根據結果更新 UI

**權限校驗流程：**
- 前端發送操作請求 (需寫入) → 後端檢查 `has_perm('app.edit_files')`
- 若無權限，後端返回 403 Forbidden
- 前端攔截 403 並顯示錯誤訊息

### 5.2 錯誤處理與 HTTP 攔截器

**建立 HTTP 攔截器：**
- 攔截所有 `/api/file-manager/` 請求
- 自動添加認證令牌 (Authorization Header)
- 攔截回應，處理特定的 HTTP 狀態碼：
  - 403：無權限，顯示特定訊息
  - 404：資源不存在
  - 409：衝突 (檔案已存在)
  - 413：檔案過大
  - 5xx：伺服器錯誤

**Toast 提醒：**
- 使用 Fuse Toast 或 PrimeNG ToastService 顯示訊息
- 成功操作：綠色 Toast，5 秒後自動關閉
- 錯誤操作：紅色 Toast，可手動關閉
- 警告訊息：黃色 Toast

### 5.3 路由守衛 (Route Guard，可選)

- 建立 CanActivate 守衛
- 進入檔案管理頁面前檢查使用者是否至少具備 `view_files` 權限
- 無權限則重定向至 403 頁面

---

## 6. 測試計劃

### 6.1 後端測試

**單元測試 (Unit Tests)：**
- 路徑驗證邏輯：測試合法與非法路徑
- 副檔名黑名單：測試允許與禁止的副檔名
- 權限檢查：測試 `view_files` 與 `edit_files` 權限
- 檔案操作邏輯：上傳、刪除、重新命名、移動

**整合測試 (Integration Tests)：**
- 端點測試：模擬前端請求，驗證回應
- 權限測試：不同權限的使用者執行操作
- 檔案系統操作：驗證檔案確實被建立/刪除
- 錯誤情況：測試各種邊界條件

**安全測試 (Security Tests)：**
- 路徑遍歷攻擊：嘗試 `../../../etc/passwd` 等
- 副檔名繞過：嘗試 `.php.jpg` 等
- 權限繞過：未認證使用者執行操作
- 大檔案上傳：測試大小限制

### 6.2 前端測試

**單元測試：**
- FileService：測試 API 呼叫
- Components：測試 UI 邏輯與互動
- Pipes：測試檔案大小格式化等

**端對端測試 (E2E)：**
- 使用 Cypress 或 Protractor
- 測試完整的使用者工作流：
  - 進入檔案管理頁面
  - 瀏覽檔案與資料夾
  - 上傳檔案
  - 刪除檔案
  - 重新命名
  - 下載檔案

### 6.3 功能測試

**正常流程：**
- 列表檔案並排序
- 進入資料夾與返回
- 上傳單/多檔案
- 刪除檔案與資料夾
- 重新命名

**邊界條件：**
- 空資料夾
- 深層資料夾結構 (5+ 層)
- 特殊字元檔案名 (中文、空格、特殊符號)
- 大檔案上傳 (100+ MB)
- 同時選擇多個檔案並刪除

### 6.4 效能測試

**大檔案處理：**
- 測試上傳 500+ MB 檔案的穩定性
- 測試多個大檔案同時上傳

**路徑壓力測試：**
- 測試 10+ 層深的資料夾結構
- 測試 1000+ 個檔案的列表頁面

**權限切換測試：**
- 模擬不同權限的使用者登入
- 驗證 UI 按鈕是否正確隱藏/顯示
- 驗證權限變更後的即時響應

---

## 7. 部署與維護

### 7.1 部署前檢查清單

**後端：**
- [ ] 所有單元和整合測試通過
- [ ] 安全測試通過 (路徑遍歷、副檔名檢查等)
- [ ] 性能測試滿足要求
- [ ] 錯誤日誌設定完成
- [ ] 監審日誌設定完成
- [ ] 環境變數配置 (STORAGE_ROOT, MAX_FILE_SIZE 等)

**前端：**
- [ ] 所有單元和 E2E 測試通過
- [ ] 建置輸出無警告
- [ ] 相容性測試 (跨瀏覽器)
- [ ] 無障礙性檢查 (Accessibility)

### 7.2 上線步驟

1. 後端部署：更新 Django 應用並執行遷移 (`python manage.py migrate`)
2. 前端建置：編譯 Angular 應用 (`ng build --prod`)
3. 靜態檔案：收集前端資源 (`python manage.py collectstatic`)
4. 權限初始化：建立或分配 `view_files` 與 `edit_files` 權限至使用者
5. 建立儲存目錄：確保 `MEDIA_ROOT/storage/` 目錄存在且權限正確
6. 測試驗證：測試不同權限的使用者能否正常使用檔案管理器

### 7.3 監控與維護

**監控指標：**
- API 回應時間
- 上傳成功率
- 錯誤日誌數量
- 磁碟空間使用
- 權限拒絕率

**定期維護任務：**
- 清理過期的臨時檔案
- 分析日誌，識別異常操作
- 更新黑名單副檔名清單
- 定期備份重要檔案

---

## 8. 開發順序建議

### 第一階段：後端基礎 (優先級：高)
1. 檔案系統結構配置
2. 路徑驗證與安全檢查邏輯
3. Django 應用與權限定義
4. Serializers 實作
5. 單元測試

### 第二階段：後端 API (優先級：高)
1. 列表端點 (GET /api/file-manager/list/)
2. 上傳端點 (POST /api/file-manager/upload/)
3. 操作端點 (POST /api/file-manager/action/)
4. 下載端點 (GET /api/file-manager/download/)
5. 權限端點 (GET /api/file-manager/permissions/)
6. 整合測試與安全測試

### 第三階段：前端服務層 (優先級：高)
1. FileService 建立與狀態管理
2. HTTP 攔截器與錯誤處理
3. TypeScript Interfaces 定義
4. 服務層單元測試

### 第四階段：前端 UI - 基礎 (優先級：中)
1. 頁面佈局整合
2. 麵包屑導航
3. 檔案列表檢視 (MatTable)
4. 基礎路由導航

### 第五階段：前端 UI - 互動 (優先級：中)
1. 上傳功能 (PrimeNG p-fileUpload)
2. 右鍵選單 (PrimeNG p-contextMenu)
3. 建立資料夾
4. 刪除/重新命名對話框

### 第六階段：前端 UI - 完善 (優先級：低)
1. 檔案樹狀導航 (可選)
2. 搜尋功能 (可選)
3. 預覽功能 (可選)
4. 響應式設計調整

### 第七階段：測試與部署 (優先級：高)
1. 完整 E2E 測試
2. 效能測試
3. 安全測試補充
4. 部署與驗證

---

## 9. 技術細節參考

### 9.1 常見問題與解決方案

**Q: 如何處理非常深的資料夾結構？**
A: 使用虛擬滾動或無限滾動，避免一次性加載全部檔案

**Q: 如何優化大量檔案的列表顯示？**
A: 使用分頁或虛擬滾動 (PrimeNG p-virtualScroller)

**Q: 如何實作檔案預覽？**
A: 前端顯示預覽，後端提供檔案內容或預縮圖 API

**Q: 如何處理檔案名衝突？**
A: 後端可自動重新命名 (append timestamp) 或返回 409 衝突錯誤

**Q: 能否實作檔案分享功能？**
A: 可在後續迭代中添加分享連結 API

### 9.2 安全檢查清單

- [ ] 路徑遍歷防護已實作
- [ ] 副檔名黑名單已配置
- [ ] MIME 類型驗證已實作
- [ ] 檔案大小限制已設定
- [ ] 使用者認證已檢查
- [ ] 權限檢查已實行
- [ ] SQL 注入防護 (ORM 使用)
- [ ] CSRF 保護已啟用
- [ ] 日誌記錄已完成
- [ ] 錯誤訊息不洩漏敏感資訊

### 9.3 效能優化建議

- 使用 CDN 加速靜態資源
- 檔案列表實作分頁
- 前端快取權限資訊
- 後端快取常訪問的目錄
- 大檔案上傳使用分塊上傳 (Chunked Upload，可選)
- 使用壓縮 (gzip) 減少傳輸量

---

## 10. 文件與註解規範

### 10.1 代碼註解

**後端 (Django/Python)：**
- 使用 docstrings 註解每個 Class 與 Method
- 複雜邏輯使用行內註解
- 遵循 PEP 257 規範

**前端 (Angular/TypeScript)：**
- 使用 JSDoc 格式註解 Classes 與 Methods
- 重要邏輯使用行內註解
- 在 interfaces 與 types 中添加說明

### 10.2 API 文件

- 使用 Django REST Framework 自動文件生成或 Swagger/OpenAPI
- 文件應包含：
  - 端點 URL 與 HTTP 方法
  - 請求參數與格式
  - 回應格式與範例
  - 可能的錯誤狀態碼
  - 所需權限

### 10.3 設計文件

- 系統架構圖
- 資料流圖
- 資料庫 Schema (若有)
- API 端點總覽
- 權限模型說明

---

## 11. 變更日誌

### 版本 1.0 (初始版本)
- 基礎檔案列表、上傳、刪除、重新命名、移動功能
- 全局讀取/寫入權限控制
- 路徑遍歷防護與副檔名黑名單

### 後續迭代 (可選)
- v1.1：檔案預覽功能
- v1.2：搜尋與過濾
- v1.3：檔案分享連結
- v2.0：分塊上傳與斷點續傳

---

## 12. 附錄：相關資源與文件

- [Django REST Framework 官方文件](https://www.django-rest-framework.org/)
- [Angular 官方文件](https://angular.io/docs)
- [Angular Material 元件庫](https://material.angular.io/)
- [PrimeNG 元件庫](https://primeng.org/)
- [Fuse Angular 模板文件](https://angular-material.fusetheme.com/documentation/)
- [OWASP 檔案上傳安全指南](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)
- [Tailwind CSS 文件](https://tailwindcss.com/docs)

---

**文件版本：** 1.0  
**最後更新：** 2025-01-08  
**作者：** Development Team
