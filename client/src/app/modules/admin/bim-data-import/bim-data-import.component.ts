import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { finalize, Subject, Subscription, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BimDataImportService } from './bim-data-import.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Table, TableModule } from 'primeng/table';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { WebsocketService } from 'app/core/services/websocket/websocket.service';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { NgClass } from '@angular/common';
import { GtsConfirmationService } from '@gts/services/confirmation';


@Component({
    selector: 'app-bim-data-import',
    templateUrl: './bim-data-import.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatButtonModule, MatIconModule, MatProgressSpinnerModule,
        TranslocoModule, TableModule, NgClass
    ]
})
export class BimDataImportComponent implements OnInit, OnDestroy {

    @ViewChild('fileInput') fileInput!: ElementRef;
    @ViewChild('dataTable') dataTable!: Table;
    private _subscription: Subscription = new Subscription();
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    files: any[] = [];
    selectedFiles: any[] = [];
    isLoading: boolean = false;

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _toastService: ToastService,
        private _translocoService: TranslocoService,
        private _gtsConfirmationService: GtsConfirmationService,
        private _websocketService: WebsocketService,
        private _bimDataImportService: BimDataImportService,
    ) { }

    ngOnInit(): void {
        // Subscribe webSocket message
        this._websocketService.connect('progress');
        this._subscription.add(
            this._websocketService.onMessage('progress').subscribe({
                next: (res) => {

                    res.name = decodeURIComponent(res.name);

                    // 根據 WebSocket 訊息更新檔案列表中的檔案
                    this.files = this.files.map(file => {
                        if (file.name === res.name) {
                            return {
                                ...file,
                                status: res.status,
                                message: res.message
                            };
                        }
                        return file;
                    });

                    this._changeDetectorRef.markForCheck();
                },
                error: (err) => console.error('WebSocket error:', err),
                complete: () => console.log('WebSocket connection closed.'),
            })
        );

        // Get objects
        this.isLoading = true;
        this._bimDataImportService.getData()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (res) => {
                    let data = this._calculateFileSize(res);
                    this.files = data;
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                },
                error: (e) => {
                    this.isLoading = false;
                    console.error('Error loading data:', e);
                }
            })
    }

    triggerFileInput(): void {
        this.fileInput.nativeElement.click();
    }

    onFileSelected(event: any): void {

        if (event.target.files) {
            const selectedFiles = this._calculateFileSize(event.target.files)

            // 過濾掉重複的文件
            const newFilesToUpload = selectedFiles.filter(selectedFile => {
                const isDuplicate = this.files.some(existingFile => existingFile.name === selectedFile.name);

                if (isDuplicate) {
                    this._toastService.open({ message: `${selectedFile.name} ${this._translocoService.translate('already-exists')}.` });
                }

                return !isDuplicate;
            });

            // 合併檔案
            this.files = [...newFilesToUpload, ...this.files];

            // 自動上傳新添加的文件
            newFilesToUpload.forEach(file => {
                // 延遲一點時間讓 UI 更新後再開始上傳
                setTimeout(() => {
                    this.onBimDataImport(file);
                }, 100);
            });

            // 重置 input 的值
            event.target.value = '';

            this._changeDetectorRef.markForCheck();
        }
    }

    onBimDataImport(file: any): void {

        if (file.status === 'ready') {
            const fileName = file.name;
            const parts = fileName.split('-');

            // 檢查檔案格式是否至少有 4 組
            if (parts.length < 4) {
                // alert(`Invalid file name format: '${fileName}'. Must have at least 4 parts separated by '-'.`);
                file.status = 'error';
                file.message = `Invalid file name format: '${fileName}'. Must have at least 4 parts separated by '-'.`;
                return;
            }

            // 格式正確，執行上傳
            this._bimDataImport(file);
        }
        else {

            let dialogRef = this._gtsConfirmationService.open({
                title: this._translocoService.translate('confirm-action'),
                message: this._translocoService.translate('re-translate-confirm'),
                icon: { color: 'primary' },
                actions: {
                    confirm: { label: this._translocoService.translate('confirm') },
                    cancel: { label: this._translocoService.translate('cancel') }
                }

            });

            dialogRef.afterClosed().subscribe(res => {
                if (res === 'confirmed') {
                    this._bimDataReload(file);
                }
            });
        }

        // if (!this._apsCredentials.check()) {
        //     this._apsCredentials.open().afterClosed().subscribe(res => {
        //         if (res != 'confirmed') return;
        //         this._bimDataImport(file);
        //     });
        // }
        // else { 
        //     this._bimDataImport(file);
        //  }
    }

    private _bimDataImport(file: any) {
        this._bimDataImportService.bimDataImport(file.file)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (res) => {
                    file.status = 'process';
                    if (res.type == HttpEventType.UploadProgress) {
                        let progress = Math.round(100 * (res.loaded / res.total));
                        file.status = "uploading"
                        file.message = progress === 100 ? 'Saving file...' : `Uploading: ${progress}%`;
                        this._changeDetectorRef.markForCheck();
                    }
                },
                error: (err) => {
                    file.status = 'error';
                    file.message = err.error ? JSON.stringify(err.error) : JSON.stringify(err);
                    this._changeDetectorRef.markForCheck();
                },
                complete: () => {
                    // file.status = "complete"
                    // file.message = 'upload-completed'
                    // console.log('upload-completed')
                    // this._changeDetectorRef.markForCheck();
                }
            });
    }

    private _bimDataReload(file: any) {

        this._bimDataImportService.bimDataReload(file.name)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (res) => {
                    file.status = 'process';
                },
                error: (err) => {

                    file.status = 'error';
                    file.message = err.error ? JSON.stringify(err.error) : JSON.stringify(err);
                    this._changeDetectorRef.markForCheck();
                }
            });
    }

    onDelete(file: any) {
        if (file.status === 'ready') {
            this.files = this.files.filter(e => e.name != file.name);
            this._changeDetectorRef.markForCheck();
        }
        else {
            let dialogRef = this._gtsConfirmationService.open({
                title: this._translocoService.translate('confirm-action'),
                message: this._translocoService.translate('delete-confirm'),
                icon: { color: 'warn' },
                actions: {
                    confirm: { label: this._translocoService.translate('delete') },
                    cancel: { label: this._translocoService.translate('cancel') }
                }

            });

            dialogRef.afterClosed().subscribe(res => {
                if (res === 'confirmed') {
                    this._delete(file);
                    this._changeDetectorRef.markForCheck();
                }
            });
        }
    }

    private _delete(file: any) {
        this.isLoading = true;
        this._bimDataImportService.delete(file.name).pipe(
            finalize(() => {
                this.isLoading = false;
                this._changeDetectorRef.markForCheck();
            })
        ).subscribe({
            next: (res) => {
                this.files = this.files.filter(item => item.name !== file.name);
                this._toastService.open({ message: this._translocoService.translate('delete-success') });
                this._changeDetectorRef.markForCheck();
            }
        });
    }

    private _calculateFileSize(files: any[]) {
        return Array.from(files).map((file: any) => {
            const sizeInMB = file.size / (1024 * 1024); // 轉換為 MB/GB
            const size = sizeInMB >= 1000
                ? `${(sizeInMB / 1024).toFixed(2)} GB`
                : `${sizeInMB.toFixed(2)} MB`;

            return {
                name: file.name,
                size: size, // 動態決定單位
                type: file.type,
                lastModified: file.lastModified,
                status: file.is_oss ? 'complete' : 'ready', // 新增 status 屬性
                message: '',
                file: file
            };
        });
    }

    // 檢查是否所有可刪除的文件都已被選中
    isAllDeletableFilesSelected(): boolean {
        const deletableFiles = this.files.filter(f =>
            ['ready', 'complete', 'error'].includes(f.status)
        );
        return deletableFiles.length > 0 &&
               this.selectedFiles.length === deletableFiles.length;
    }

    // 切換全選狀態（只選擇可刪除的文件）
    toggleSelectAll(): void {
        const deletableFiles = this.files.filter(f =>
            ['ready', 'complete', 'error'].includes(f.status)
        );

        if (this.isAllDeletableFilesSelected()) {
            // 取消全選
            this.selectedFiles = [];
        } else {
            // 全選可刪除的文件
            this.selectedFiles = [...deletableFiles];
        }
        this._changeDetectorRef.markForCheck();
    }

    // 切換 row 的選擇狀態
    toggleRowSelection(file: any, event: Event): void {
        // 如果文件狀態不是可刪除的，直接返回
        if (!['ready', 'complete', 'error'].includes(file.status)) {
            return;
        }

        // 檢查是否點擊了按鈕、checkbox 或其子元素
        const target = event.target as HTMLElement;
        if (target.closest('button') ||
            target.closest('mat-icon') ||
            target.closest('mat-progress-spinner') ||
            target.closest('p-tablecheckbox') ||
            target.closest('.p-checkbox')) {
            return;
        }

        // 切換選擇狀態
        const index = this.selectedFiles.findIndex(f => f.name === file.name);
        if (index > -1) {
            // 移除選擇：創建新數組以觸發變更檢測
            this.selectedFiles = this.selectedFiles.filter(f => f.name !== file.name);
        } else {
            // 添加選擇：創建新數組以觸發變更檢測
            this.selectedFiles = [...this.selectedFiles, file];
        }
        this._changeDetectorRef.markForCheck();
    }

    // 批量刪除
    onBatchDelete(): void {
        if (this.selectedFiles.length === 0) {
            this._toastService.open({
                message: this._translocoService.translate('no-files-selected')
            });
            return;
        }

        const dialogRef = this._gtsConfirmationService.open({
            title: this._translocoService.translate('confirm-action'),
            message: this._translocoService.translate('batch-delete-confirm', {
                count: this.selectedFiles.length
            }),
            icon: { color: 'warn' },
            actions: {
                confirm: { label: this._translocoService.translate('delete') },
                cancel: { label: this._translocoService.translate('cancel') }
            }
        });

        dialogRef.afterClosed().subscribe(res => {
            if (res === 'confirmed') {
                this._batchDelete();
            }
        });
    }

    private _batchDelete(): void {
        this.isLoading = true;
        this._changeDetectorRef.markForCheck(); // 立即顯示 loading spinner

        // 分離 ready 狀態和其他狀態的文件
        const readyFiles = this.selectedFiles.filter(f => f.status === 'ready');
        const otherFiles = this.selectedFiles.filter(f => f.status !== 'ready');

        // 直接從列表移除 ready 狀態的文件
        readyFiles.forEach(file => {
            this.files = this.files.filter(e => e.name !== file.name);
        });

        // 如果沒有需要調用 API 刪除的文件，直接結束
        if (otherFiles.length === 0) {
            this.selectedFiles = [];
            this.isLoading = false;
            this._toastService.open({
                message: this._translocoService.translate('delete-success')
            });
            this._changeDetectorRef.markForCheck();
            return;
        }

        // 刪除其他狀態的文件（需要調用 API）
        let completedCount = 0;
        let errorCount = 0;

        otherFiles.forEach(file => {
            this._bimDataImportService.delete(file.name).subscribe({
                next: () => {
                    this.files = this.files.filter(item => item.name !== file.name);
                    completedCount++;

                    if (completedCount + errorCount === otherFiles.length) {
                        this._finalizeBatchDelete(completedCount, errorCount);
                    }
                },
                error: (err) => {
                    console.error(`Failed to delete ${file.name}:`, err);
                    errorCount++;

                    if (completedCount + errorCount === otherFiles.length) {
                        this._finalizeBatchDelete(completedCount, errorCount);
                    }
                }
            });
        });
    }

    private _finalizeBatchDelete(successCount: number, errorCount: number): void {
        this.selectedFiles = [];
        this.isLoading = false;

        if (errorCount > 0) {
            this._toastService.open({
                message: this._translocoService.translate('batch-delete-partial', {
                    success: successCount,
                    error: errorCount
                })
            });
        } else {
            this._toastService.open({
                message: this._translocoService.translate('delete-success')
            });
        }

        this._changeDetectorRef.markForCheck();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
        this._subscription.unsubscribe();
        this._websocketService.close('progress');
    }
}
