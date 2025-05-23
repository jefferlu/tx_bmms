import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { BimModelViewerService } from './bim-model-viewer.service';
import { MatDialog } from '@angular/material/dialog';
import { ApsDiffComponent } from 'app/layout/common/aps-diff/aps-diff.component';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { ApsViewerComponent } from 'app/layout/common/aps-viewer/aps-viewer.component';
import { GtsConfirmationService } from '@gts/services/confirmation';
import { WebsocketService } from 'app/core/services/websocket/websocket.service';
import { Subject, Subscription } from 'rxjs';


@Component({
    selector: 'app-bim-model-viewer',
    templateUrl: './bim-model-viewer.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe, FormsModule, TranslocoModule, TableModule, ButtonModule,
        MatIconModule, MatButtonModule, MatInputModule
    ]
})
export class BimModelViewerComponent implements OnInit, OnDestroy {

    private _subscription: Subscription = new Subscription();
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    data: any;
    selectedItems!: any;
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
                    console.log(res)
                    res.name = decodeURIComponent(res.name);

                    // 根據 WebSocket 訊息更新檔案列表中的檔案
                    this.data = this.data.map(d => {
                        if (d.name === res.name) {
                            return {
                                ...d,
                                status: res.status,
                                message: res.message
                            };
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

    onClickAggregated(): void {
        if (!this.selectedItems) {
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
        if (!this.selectedItems) {
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
                            alert('下載失敗，請聯繫管理員');
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
                            alert('下載失敗，請聯繫管理員');
                            this._toastService.open({ message: '下載失敗，請聯繫管理員' });
                        });
                    }
                });
            }
        });
    }

    revertToLastVersion(fileName: string): void {
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
                // this.isLoading = true;
                // this._changeDetectorRef.markForCheck();
                // this._bimModelViewerService.downloadBim(fileName, version).subscribe({
                //     next: (blob: Blob) => {
                //         // 創建 Blob 並生成臨時 URL
                //         const binFilename = version && version.trim() !== ''
                //             ? `${fileName.split('.')[0]}_${version}.${fileName.split('.')[1]}`
                //             : fileName;
                //         const downloadUrl = window.URL.createObjectURL(blob);
                //         const link = document.createElement('a');
                //         link.href = downloadUrl;
                //         link.download = binFilename; // 檔案名稱，與 API 的 filename 一致
                //         document.body.appendChild(link);
                //         link.click();
                //         document.body.removeChild(link);
                //         window.URL.revokeObjectURL(downloadUrl); // 清理臨時 URL
                //         this.isLoading = false;
                //         this._changeDetectorRef.markForCheck();
                //     },
                //     error: (error) => {
                //         // 處理錯誤（例如 HTTP 400, 404, 500）
                //         this.isLoading = false;
                //         this._changeDetectorRef.markForCheck();
                //         error.error.text().then((errorMessage: string) => {
                //             const errorJson = JSON.parse(errorMessage);
                //             this._toastService.open({ message: errorJson.error || errorJson.message || '下載失敗，請稍後再試' });
                //         }).catch(() => {
                //             alert('下載失敗，請聯繫管理員');
                //             this._toastService.open({ message: '下載失敗，請聯繫管理員' });
                //         });
                //     }
                // });
            }
        });
    }

    private checkTenderConsistency(data: any[]): boolean {
        const tenders = data.map(item => item.tender);
        return tenders.every(tender => tender === tenders[0]);
    }

    ngOnDestroy(): void { }
}
