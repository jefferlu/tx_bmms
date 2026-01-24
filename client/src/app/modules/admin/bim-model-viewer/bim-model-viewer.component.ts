import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, NgClass } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CheckboxModule } from 'primeng/checkbox';
import { BimModelViewerService } from './bim-model-viewer.service';
import { MatDialog } from '@angular/material/dialog';
import { ApsDiffComponent } from 'app/layout/common/aps-diff/aps-diff.component';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { ApsViewerComponent } from 'app/layout/common/aps-viewer/aps-viewer.component';
import { GtsConfirmationService } from '@gts/services/confirmation';
import { WebsocketService } from 'app/core/services/websocket/websocket.service';
import { Subject, Subscription, takeUntil } from 'rxjs';


@Component({
    selector: 'app-bim-model-viewer',
    templateUrl: './bim-model-viewer.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe, FormsModule, TranslocoModule, TableModule, ButtonModule,
        MatIconModule, MatButtonModule, MatInputModule, NgClass, CheckboxModule
    ]
})
export class BimModelViewerComponent implements OnInit, OnDestroy {

    private _subscription: Subscription = new Subscription();
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    data: any;
    selectedItems: any[] = [];
    isLoading: boolean = false;

    constructor(
        private _route: ActivatedRoute,
        private _changeDetectorRef: ChangeDetectorRef,
        private _translocoService: TranslocoService,
        private _toastService: ToastService,
        private _matDialog: MatDialog,
        private _gtsConfirmationService: GtsConfirmationService,
        private _bimModelViewerService: BimModelViewerService,
        private _websocketService: WebsocketService
    ) { }

    ngOnInit(): void {
        // Subscribe webSocket message
        this._websocketService.connect('update-category');
        this._subscription.add(
            this._websocketService.onMessage('update-category').subscribe({
                next: (res) => {
                    // console.log(res)
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
                            console.log('complete')
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
                this.data = res.data;
                this._changeDetectorRef.markForCheck();
                console.log('Data loaded:', this.data);
            },
            error: (e) => {
                console.error('Error loading data:', e);
            }
        });
    }

    // 获取所有可选择的文件（status 为空或 complete）
    getSelectableFiles(): any[] {
        if (!this.data) return [];
        return this.data.filter(item => !item.status || item.status === 'complete');
    }

    // 检查是否所有可选文件都已被选中
    isAllSelectableFilesSelected(): boolean {
        const selectableFiles = this.getSelectableFiles();
        if (selectableFiles.length === 0) return false;

        return selectableFiles.every(file =>
            this.selectedItems.some(selected => selected.name === file.name)
        );
    }

    // 全选/取消全选
    toggleSelectAll(): void {
        const selectableFiles = this.getSelectableFiles();

        if (this.isAllSelectableFilesSelected()) {
            this.selectedItems = [];
        } else {
            this.selectedItems = [...selectableFiles];
        }
        this._changeDetectorRef.detectChanges();
    }

    // 获取分组下的所有可选文件
    getGroupSelectableFiles(tender: string): any[] {
        if (!this.data) return [];
        return this.data.filter(item =>
            item.tender === tender &&
            (!item.status || item.status === 'complete')
        );
    }

    // 检查分组是否全选
    isGroupSelected(tender: string): boolean {
        const groupFiles = this.getGroupSelectableFiles(tender);
        if (groupFiles.length === 0) return false;

        return groupFiles.every(file =>
            this.selectedItems.some(selected => selected.name === file.name)
        );
    }

    // 分组全选/取消全选
    toggleGroupSelection(tender: string): void {
        const groupFiles = this.getGroupSelectableFiles(tender);

        if (this.isGroupSelected(tender)) {
            // 取消选择该分组的所有文件
            this.selectedItems = this.selectedItems.filter(selected =>
                !groupFiles.some(file => file.name === selected.name)
            );
        } else {
            // 选择该分组的所有文件
            const newSelections = groupFiles.filter(file =>
                !this.selectedItems.some(selected => selected.name === file.name)
            );
            this.selectedItems = [...this.selectedItems, ...newSelections];
        }
        this._changeDetectorRef.detectChanges();
    }

    // 行点击切换选择（用于文件行）
    toggleRowSelection(file: any, event: Event): void {
        if (file.status && file.status !== 'complete') {
            return;
        }

        const target = event.target as HTMLElement;
        // 检查是否点击了按钮或图标
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
        this._changeDetectorRef.detectChanges();
    }

    // 分组行点击切换选择
    toggleGroupRowSelection(tender: string, event: Event): void {
        const target = event.target as HTMLElement;
        // 检查是否点击了展开按钮或 checkbox
        if (target.closest('button') ||
            target.closest('p-checkbox') ||
            target.closest('.p-checkbox')) {
            return;
        }

        this.toggleGroupSelection(tender);
    }

    // 监听 PrimeNG 选择变化事件，触发变更检测
    onSelectionChange(): void {
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
        console.log(this.selectedItems);
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
        let dialogRef = this._gtsConfirmationService.open({
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
                this._bimModelViewerService.downloadCsv(fileName).subscribe({
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
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
        this._subscription.unsubscribe();
        this._websocketService.close('update-category');
    }
}
