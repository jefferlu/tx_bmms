import { inject, Injector } from "@angular/core";
import { ApsViewerService } from "../aps-viewer.service";
import { TranslocoService } from "@jsverse/transloco";
import { ToastService } from "../../toast/toast.service";

declare const Autodesk: any;

export class DownloadPanel extends Autodesk.Viewing.UI.DockingPanel {
    private _apsViewerService: ApsViewerService;
    private _translocoService: TranslocoService;
    private _toastService: ToastService;

    private viewer: any;
    private filenameSelect: HTMLSelectElement;
    private downloadButton: HTMLButtonElement;
    private statusDiv: HTMLDivElement;

    private type: 'sqlite' | 'csv';

    constructor(viewer: any, container: HTMLElement, id: string, title: string, options: { type: 'sqlite' | 'csv' } = { type: 'sqlite' }, injector: Injector) {
        super(container, id, title, options);

        this._apsViewerService = injector.get(ApsViewerService);
        this._translocoService = injector.get(TranslocoService);
        this._toastService = injector.get(ToastService);

        this.viewer = viewer;
        this.type = options.type || 'sqlite';

        // 設置面板樣式
        this.container.classList.add('docking-panel-container-solid-color-a');
        this.container.style.top = '10px';
        this.container.style.left = '10px';
        this.container.style.width = 'auto';
        this.container.style.height = 'auto';
        this.container.style.resize = 'auto';

        // 創建內容容器
        const div = document.createElement('div');
        div.className = 'p-4'; // Tailwind: 內距 1rem

        // 創建下拉選單和按鈕容器
        const inputContainer = document.createElement('div');
        inputContainer.className = 'flex space-x-2 mb-4'; // Tailwind: flex 布局，水平間距 0.5rem，底部間距 1rem

        // 創建檔案名稱下拉選單
        this.filenameSelect = document.createElement('select');
        this.filenameSelect.id = 'filename-select';
        this.filenameSelect.className = 'border rounded px-2 py-1 text-sm bg-transparent'; // Tailwind: 邊框、圓角、內距、文字大小、寬度
        this.populateFilenameOptions();
        inputContainer.appendChild(this.filenameSelect);

        // 創建匯出/下載按鈕
        this.downloadButton = document.createElement('button');
        this.downloadButton.type = 'button';
        this.downloadButton.id = 'btn-download';
        this.downloadButton.innerText = this.type === 'sqlite' ? this._translocoService.translate('download') : this._translocoService.translate('export');
        this.downloadButton.className = 'bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600 text-sm'; // Tailwind: 藍色背景、白色文字、內距、圓角、hover 效果
        inputContainer.appendChild(this.downloadButton);

        div.appendChild(inputContainer);

        // 創建狀態訊息容器
        this.statusDiv = document.createElement('div');
        this.statusDiv.id = 'download-status';
        this.statusDiv.className = 'my-4 text-sm'; // Tailwind: 垂直間距、文字大小
        div.appendChild(this.statusDiv);

        // 綁定事件
        this.downloadButton.addEventListener('click', () => this.download());
        this.filenameSelect.addEventListener('keyup', (event: any) => {
            if (event.key === 'Enter') {
                this.downloadButton.click();
            }
        });

        this.container.appendChild(div);
    }

    private download(): void {
        const fileName = this.filenameSelect.value;
        if (this.type == 'csv') {
            this._apsViewerService.downloadCsv(fileName).subscribe({
                next: (blob: Blob) => {
                    // 創建 Blob 並生成臨時 URL
                    const csvFilename = `${fileName.split('.')[0]}.csv`;
                    const downloadUrl = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = downloadUrl;
                    link.download = csvFilename; // 檔案名稱，與 API 的 filename 一致
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(downloadUrl); // 清理臨時 URL
                    this._toastService.open({ message: '匯出成功' });
                },
                error: (error) => {
                    error.error.text().then((errorMessage: string) => {
                        const errorJson = JSON.parse(errorMessage);
                        this._toastService.open({ message: errorJson.error || errorJson.message || '匯出失敗，請稍後再試' });
                    }).catch(() => {
                        this._toastService.open({ message: '匯出失敗，請聯繫管理員' });
                    });
                }
            });
        }
        else {
            this._apsViewerService.downloadSqlite(fileName).subscribe({
                next: (blob: Blob) => {
                    // 創建 Blob 並生成臨時 URL
                    const csvFilename = `${fileName.split('.')[0]}.db`;
                    const downloadUrl = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = downloadUrl;
                    link.download = csvFilename; // 檔案名稱，與 API 的 filename 一致
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(downloadUrl); // 清理臨時 URL
                    this._toastService.open({ message: '下載成功' });
                },
                error: (error) => {
                    // 處理錯誤（例如 HTTP 400, 404, 500）
                    error.error.text().then((errorMessage: string) => {
                        const errorJson = JSON.parse(errorMessage);
                        this._toastService.open({ message: errorJson.error || errorJson.message || '下載失敗，請稍後再試' });
                    }).catch(() => {
                        this._toastService.open({ message: '下載失敗，請聯繫管理員' });
                    });
                }
            });
        }
    }

    private populateFilenameOptions(): void {
        // 清空現有選項
        this.filenameSelect.innerHTML = '';

        // 獲取所有已載入模型
        const models = this.viewer.getAllModels?.() || [this.viewer.model];

        // 添加預設選項
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        this.filenameSelect.appendChild(defaultOption);

        // 填充模型檔案名稱
        models.forEach((model: any) => {
            const urn = model.getData().urn || 'unknown';
            const decoded = this.decodeUrn(urn);
            const filename = decoded.split('/').pop();

            const option = document.createElement('option');
            option.value = filename;
            option.text = filename;
            this.filenameSelect.appendChild(option);
        });
        this.filenameSelect.selectedIndex = 1;
    }

    private decodeUrn(urn: string): string {
        // 去掉前綴
        const base64Urn = urn.replace('urn:', '');

        // Base64 URL-safe 轉標準 Base64
        const standardBase64 = base64Urn.replace(/-/g, '+').replace(/_/g, '/');

        // 補足字元數，使長度為 4 的倍數
        const paddedBase64 = standardBase64.padEnd(standardBase64.length + (4 - standardBase64.length % 4) % 4, '=');

        // 解碼
        try {
            const decoded = atob(paddedBase64);
            return decoded;
        } catch (err) {
            console.error('解碼錯誤:', err);
            return '';
        }
    }

    public refreshOptions(): void {
        this.populateFilenameOptions();
    }
}