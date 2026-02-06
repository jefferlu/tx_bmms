import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, NgClass } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { BimModelViewerService } from './bim-model-viewer.service';
import { MatDialog } from '@angular/material/dialog';
import { ApsDiffComponent } from 'app/layout/common/aps-diff/aps-diff.component';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { ApsViewerComponent } from 'app/layout/common/aps-viewer/aps-viewer.component';
import { GtsConfirmationService } from '@gts/services/confirmation';
import { WebsocketService } from 'app/core/services/websocket/websocket.service';
import { BreadcrumbService } from 'app/core/services/breadcrumb/breadcrumb.service';
import { Subject, Subscription, takeUntil } from 'rxjs';
import * as XLSX from 'xlsx';


@Component({
    selector: 'app-bim-model-viewer',
    templateUrl: './bim-model-viewer.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe, FormsModule, TranslocoModule, TableModule, ButtonModule, InputTextModule,
        MatIconModule, MatButtonModule, MatInputModule, NgClass, CheckboxModule,
        IconField, InputIcon
    ]
})
export class BimModelViewerComponent implements OnInit, OnDestroy {

    private _subscription: Subscription = new Subscription();
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    data: any[] = [];
    totalRecords: number = 0;
    first: number = 0;
    rowsPerPage: number = 10;
    selectedItems: any[] = [];
    isLoading: boolean = false;
    groupCheckboxStates: { [key: string]: boolean } = {};
    expandedRowKeys: { [key: string]: boolean } = {};
    isAllExpanded: boolean = true;
    keyword: string = '';

    constructor(
        private _route: ActivatedRoute,
        private _changeDetectorRef: ChangeDetectorRef,
        private _translocoService: TranslocoService,
        private _toastService: ToastService,
        private _matDialog: MatDialog,
        private _gtsConfirmationService: GtsConfirmationService,
        private _bimModelViewerService: BimModelViewerService,
        private _websocketService: WebsocketService,
        private _breadcrumbService: BreadcrumbService
    ) { }

    ngOnInit(): void {
        // 初始化 breadcrumb
        this.updateBreadcrumb();

        // 監聽語系變化以更新 breadcrumb
        this._translocoService.langChanges$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => {
                this.updateBreadcrumb();
            });

        // Subscribe webSocket message
        this._websocketService.connect('update-category');
        this._subscription.add(
            this._websocketService.onMessage('update-category').subscribe({
                next: (res) => {
                    // this.isLoading = true;
                    // this._changeDetectorRef.markForCheck();

                    res.name = decodeURIComponent(res.name);

                    // 根據 WebSocket 訊息更新檔案列表中的檔案
                    this.data = this.data.map(d => {
                        if (d.name === res.name) {
                            if (res.status === 'complete') d.version += 1;
                            return {
                                ...d,
                                status: res.status,
                                message: res.message
                            };
                        }

                        if (res.status === 'complete') {
                            d.version += 1;
                            // this.isLoading = false;
                            this._changeDetectorRef.markForCheck();
                        }

                        return d;
                    });

                    this._changeDetectorRef.markForCheck();
                },
                error: (err) => console.error('WebSocket error:', err),
                complete: () => console.log('WebSocket connection closed.'),
            })
        );

        this._route.data.subscribe({
            next: (res) => {
                if (res.data) {
                    this.data = res.data.results || res.data;
                    this.totalRecords = res.data.count || this.data.length;
                    this.initializeExpandedState();
                }
                this._changeDetectorRef.markForCheck();
            },
            error: (e) => {
                console.error('Error loading data:', e);
            }
        });
    }

    // 搜索關鍵字
    onSearch(): void {
        this.first = 0;
        this.loadPage(1);
    }

    // 載入指定頁面的資料
    loadPage(page: number): void {
        this.isLoading = true;
        const params: any = {
            page: page,
            size: this.rowsPerPage
        };
        if (this.keyword?.trim()) {
            params.keyword = this.keyword.trim();
        }

        this._bimModelViewerService.getData(params)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (res) => {
                    this.data = res.results || res;
                    this.totalRecords = res.count || this.data.length;
                    this.initializeExpandedState();
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                },
                error: (e) => {
                    console.error('Error loading data:', e);
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                }
            });
    }

    // 處理分頁變化事件
    onPageChange(event: TableLazyLoadEvent): void {
        this.first = event.first || 0;
        this.rowsPerPage = event.rows || this.rowsPerPage;
        const page = this.first / this.rowsPerPage + 1;
        this.loadPage(page);
    }

    // 更新 breadcrumb
    private updateBreadcrumb(): void {
        this._breadcrumbService.setBreadcrumb([
            { label: this._translocoService.translate('bim-model-viewer') }
        ]);
    }

    // 初始化展開狀態（預設全部展開）
    initializeExpandedState(): void {
        if (!this.data) return;

        const tenders = [...new Set(this.data.map((item: any) => item.tender as string))];
        const newExpandedKeys: { [key: string]: boolean } = {};
        tenders.forEach((tender: string) => {
            newExpandedKeys[tender] = true; // 預設全部收合
        });
        this.expandedRowKeys = newExpandedKeys;
        this.isAllExpanded = true;
    }

    // 切換全部展開/收合
    toggleExpandAll(): void {
        if (!this.data) return;

        const tenders = [...new Set(this.data.map((item: any) => item.tender as string))];
        const newExpandedKeys: { [key: string]: boolean } = {};

        // 如果當前是全部展開，則全部收合；否則全部展開
        const newState = !this.isAllExpanded;
        tenders.forEach((tender: string) => {
            newExpandedKeys[tender] = newState;
        });

        this.expandedRowKeys = newExpandedKeys;
        this.isAllExpanded = newState;
        this._changeDetectorRef.detectChanges();
    }

    // 獲取所有可選擇的檔案（status 為空或 complete）
    getSelectableFiles(): any[] {
        if (!this.data) return [];
        return this.data.filter(item => !item.status || item.status === 'complete');
    }

    // 檢查是否所有可選檔案都已被選中
    isAllSelectableFilesSelected(): boolean {
        const selectableFiles = this.getSelectableFiles();
        if (selectableFiles.length === 0) return false;

        return selectableFiles.every(file =>
            this.selectedItems.some(selected => selected.name === file.name)
        );
    }

    // 全選/取消全選
    toggleSelectAll(): void {
        const selectableFiles = this.getSelectableFiles();

        if (this.isAllSelectableFilesSelected()) {
            this.selectedItems = [];
            // 清除所有分組狀態 - 創建新物件以觸發變更檢測
            this.groupCheckboxStates = {};
        } else {
            this.selectedItems = [...selectableFiles];
            // 更新所有分組狀態為選中
            this.updateAllGroupStates();
        }
        this._changeDetectorRef.detectChanges();
    }

    // 更新所有分組的 checkbox 狀態
    private updateAllGroupStates(): void {
        if (!this.data) return;

        // 獲取所有唯一的 tender
        const tenders = [...new Set(this.data.map((item: any) => item.tender as string))];

        // 創建新物件以觸發變更檢測
        const newStates: { [key: string]: boolean } = {};
        tenders.forEach((tender: string) => {
            newStates[tender] = this.isGroupSelected(tender);
        });
        this.groupCheckboxStates = newStates;
    }

    // 獲取分組下的所有可選檔案
    getGroupSelectableFiles(tender: string): any[] {
        if (!this.data) return [];
        return this.data.filter(item =>
            item.tender === tender &&
            (!item.status || item.status === 'complete')
        );
    }

    // 檢查分組是否全選（用於內部邏輯判斷）
    isGroupSelected(tender: string): boolean {
        const groupFiles = this.getGroupSelectableFiles(tender);
        if (groupFiles.length === 0) return false;

        return groupFiles.every(file =>
            this.selectedItems.some(selected => selected.name === file.name)
        );
    }

    // 獲取分組 checkbox 的顯示狀態（用於模板綁定）
    getGroupCheckboxState(tender: string): boolean {
        const state = this.groupCheckboxStates[tender] || false;
        return state;
    }

    // 分組全選/取消全選
    toggleGroupSelection(tender: string): void {
        const groupFiles = this.getGroupSelectableFiles(tender);
        const currentState = this.groupCheckboxStates[tender] || false;

        if (currentState) {
            // 取消選擇該分組的所有檔案
            this.selectedItems = this.selectedItems.filter(selected =>
                !groupFiles.some(file => file.name === selected.name)
            );
        } else {
            // 選擇該分組的所有檔案
            const newSelections = groupFiles.filter(file =>
                !this.selectedItems.some(selected => selected.name === file.name)
            );
            this.selectedItems = [...this.selectedItems, ...newSelections];
        }

        // 創建新物件以觸發變更檢測
        this.groupCheckboxStates = {
            ...this.groupCheckboxStates,
            [tender]: !currentState
        };
        this._changeDetectorRef.detectChanges();
    }

    // 行點擊切換選擇（用於檔案行）
    toggleRowSelection(file: any, event: Event): void {
        if (file.status && file.status !== 'complete') {
            return;
        }

        const target = event.target as HTMLElement;
        // 檢查是否點擊了按鈕或圖標
        if (target.closest('button') ||
            target.closest('mat-icon') ||
            target.closest('p-tablecheckbox') ||
            target.closest('.p-checkbox')) {
            return;
        }

        const index = this.selectedItems.findIndex(f => f.name === file.name);
        if (index > -1) {
            this.selectedItems = this.selectedItems.filter(f => f.name !== file.name);
        } else {
            this.selectedItems = [...this.selectedItems, file];
        }

        // 更新該檔案所屬分組的狀態 - 創建新物件以觸發變更檢測
        if (file.tender) {
            this.groupCheckboxStates = {
                ...this.groupCheckboxStates,
                [file.tender]: this.isGroupSelected(file.tender)
            };
        }

        this._changeDetectorRef.detectChanges();
    }

    // 分組行點擊切換選擇
    toggleGroupRowSelection(tender: string, event: Event): void {
        const target = event.target as HTMLElement;
        // 檢查是否點擊了展開按鈕或 checkbox
        if (target.closest('button') ||
            target.closest('p-checkbox') ||
            target.closest('.p-checkbox')) {
            return;
        }

        this.toggleGroupSelection(tender);
    }

    // 監聽 PrimeNG 選擇變化事件，觸發變更檢測
    onSelectionChange(): void {
        // 當檔案選擇變化時，更新所有分組的狀態
        this.updateAllGroupStates();
        this._changeDetectorRef.detectChanges();
    }

    onClickAggregated(): void {
        if (!this.selectedItems || this.selectedItems.length === 0) {
            this._toastService.open({ message: `${this._translocoService.translate('select-at-least-one-model')}.` });
            return;
        }
        // if (!this.checkTenderConsistency(this.selectedItems)) {
        //     this._toastService.open({ message: `${this._translocoService.translate('unsupported-aggregated-view')}.` });
        //     return;
        // }

        this._matDialog.open(ApsViewerComponent, {
            width: '99vw',
            height: '95vh',
            data: this.selectedItems
        })
    }

    onClickCompare(): void {
        if (!this.selectedItems || this.selectedItems.length === 0) {
            this._toastService.open({ message: `${this._translocoService.translate('select-at-least-one-model')}.` });
            return;
        }
        this.showCompareDialog(this.selectedItems)
    }

    showCompareDialog(items): void {
        this._matDialog.open(ApsDiffComponent, {
            width: '99vw',
            height: '95vh',
            data: items
        })
    }

    onDownloadCsv(fileName: string): void {
        const dialogRef = this._gtsConfirmationService.open({
            title: this._translocoService.translate('confirm-action'),
            message: this._translocoService.translate('download-cobie-properties'),
            icon: { color: 'primary' },
            actions: {
                confirm: { label: this._translocoService.translate('confirm') },
                cancel: { label: this._translocoService.translate('cancel') }
            }
        });

        dialogRef.afterClosed().subscribe(res => {
            if (res === 'confirmed') {
                this.isLoading = true;
                this._changeDetectorRef.markForCheck();

                // 獲取 COBie JSON 數據
                this._bimModelViewerService.getCobieData(fileName).subscribe({
                    next: (data: any[]) => {
                        this._generateCobieExcel(data, fileName);
                        this.isLoading = false;
                        this._changeDetectorRef.markForCheck();
                    },
                    error: (error) => {
                        this.isLoading = false;
                        this._changeDetectorRef.markForCheck();
                        this._toastService.open({ message: error?.error?.message || '下載失敗，請稍後再試' });
                    }
                });
            }
        });
    }

    /**
     * 根據 COBie 數據生成多 sheet 的 Excel 文件
     * display_name 格式: COBie.Category.PropertyName
     * 根據 Category 分類到不同的 sheet
     */
    private _generateCobieExcel(data: any[], fileName: string): void {
        // 根據 display_name 分類數據
        const sheetDataMap: { [category: string]: any[] } = {};

        data.forEach(item => {
            const displayName = item.display_name || '';
            const parts = displayName.split('.');

            // 檢查是否為有效的 COBie 格式 (至少要有 COBie.Category.xxx)
            if (parts.length < 3 || parts[0] !== 'COBie') {
                return; // 忽略無法分類的項目
            }

            const category = parts[1]; // 取得分類名稱 (Space, Component, Type 等)

            if (!sheetDataMap[category]) {
                sheetDataMap[category] = [];
            }

            sheetDataMap[category].push(item);
        });

        // 如果沒有任何有效數據
        if (Object.keys(sheetDataMap).length === 0) {
            this._toastService.open({ message: '沒有可匯出的 COBie 數據' });
            return;
        }

        // 創建 workbook
        const workbook = XLSX.utils.book_new();

        // 為每個分類創建 sheet
        Object.keys(sheetDataMap).sort().forEach(category => {
            const categoryData = sheetDataMap[category];

            // 轉換數據為 worksheet 格式
            const worksheetData = categoryData.map(item => ({
                'DBID': item.dbid,
                'Display Name': item.display_name,
                'Value': item.value
            }));

            const worksheet = XLSX.utils.json_to_sheet(worksheetData);

            // 設定欄寬
            worksheet['!cols'] = [
                { wch: 10 },  // DBID
                { wch: 40 },  // Display Name
                { wch: 30 }   // Value
            ];

            // 將 sheet 加入 workbook（sheet 名稱最長 31 字元）
            const sheetName = category.substring(0, 31);
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        });

        // 生成 Excel 文件並下載
        const excelFileName = `${fileName.split('.')[0]}_COBie.xlsx`;
        XLSX.writeFile(workbook, excelFileName);
    }

    onDownloadBim(fileName: string, version: string = null): void {
        let dialogRef = this._gtsConfirmationService.open({
            title: this._translocoService.translate('confirm-action'),
            message: this._translocoService.translate('download-original-model'),
            icon: { color: 'primary' },
            actions: {
                confirm: { label: this._translocoService.translate('confirm') },
                cancel: { label: this._translocoService.translate('cancel') }
            }

        });

        dialogRef.afterClosed().subscribe(res => {

            if (res === 'confirmed') {
                this.isLoading = true;
                this._changeDetectorRef.markForCheck();
                this._bimModelViewerService.downloadBim(fileName, version).subscribe({
                    next: (blob: Blob) => {
                        // 創建 Blob 並生成臨時 URL
                        const binFilename = version && version.trim() !== ''
                            ? `${fileName.split('.')[0]}_${version}.${fileName.split('.')[1]}`
                            : fileName;
                        const downloadUrl = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = downloadUrl;
                        link.download = binFilename; // 檔案名稱，與 API 的 filename 一致
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(downloadUrl); // 清理臨時 URL
                        this.isLoading = false;
                        this._changeDetectorRef.markForCheck();
                    },
                    error: (error) => {
                        // 處理錯誤（例如 HTTP 400, 404, 500）
                        this.isLoading = false;
                        this._changeDetectorRef.markForCheck();
                        error.error.text().then((errorMessage: string) => {
                            const errorJson = JSON.parse(errorMessage);
                            this._toastService.open({ message: errorJson.error || errorJson.message || '下載失敗，請稍後再試' });
                        }).catch(() => {
                            this._toastService.open({ message: '下載失敗，請聯繫管理員' });
                        });
                    }
                });
            }
        });
    }

    onBimDataRevert(item: any): void {
        let dialogRef = this._gtsConfirmationService.open({
            title: this._translocoService.translate('confirm-action'),
            message: this._translocoService.translate('restore-previous-backup'),
            icon: { color: 'primary' },
            actions: {
                confirm: { label: this._translocoService.translate('confirm') },
                cancel: { label: this._translocoService.translate('cancel') }
            }

        });

        dialogRef.afterClosed().subscribe(res => {
            if (res === 'confirmed') {
                this._bimModelViewerService.bimDataRevert(item.name, item.version)
                    .pipe(takeUntil(this._unsubscribeAll))
                    .subscribe({
                        next: (res) => { },
                        error: (err) => { }
                    });
            }
        });
    }

    private checkTenderConsistency(data: any[]): boolean {
        const tenders = data.map(item => item.tender);
        return tenders.every(tender => tender === tenders[0]);
    }

    ngOnDestroy(): void {
        this._breadcrumbService.clear();
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
        this._subscription.unsubscribe();
        this._websocketService.close('update-category');
    }
}
