import { inject, Injector } from "@angular/core";
import { ApsViewerService } from "../aps-viewer.service";
import { TranslocoService } from "@jsverse/transloco";

declare const Autodesk: any;

export class DownloadPanel extends Autodesk.Viewing.UI.DockingPanel {
    private _apsViewerService: ApsViewerService;
    private _translocoService: TranslocoService;

    private viewer: any;
    private filenameSelect: HTMLSelectElement;
    private downloadButton: HTMLButtonElement;
    private statusDiv: HTMLDivElement;

    private type: 'sqlite' | 'csv';

    constructor(viewer: any, container: HTMLElement, id: string, title: string, options: { type: 'sqlite' | 'csv' } = { type: 'sqlite' }, injector: Injector) {
        super(container, id, title, options);

        this._apsViewerService = injector.get(ApsViewerService);
        this._translocoService = injector.get(TranslocoService);

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
        this.filenameSelect.className = 'border rounded px-2 py-1 text-base w-40'; // Tailwind: 邊框、圓角、內距、文字大小、寬度
        this.populateFilenameOptions();
        inputContainer.appendChild(this.filenameSelect);

        // 創建下載按鈕
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
        this.downloadButton.addEventListener('click', () => this.initiateDownload());
        this.filenameSelect.addEventListener('keyup', (event: any) => {
            if (event.key === 'Enter') {
                this.downloadButton.click();
            }
        });

        this.container.appendChild(div);
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
}