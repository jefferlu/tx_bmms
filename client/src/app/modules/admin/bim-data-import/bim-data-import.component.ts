import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { finalize, Subject, Subscription, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BimDataImportService } from './bim-data-import.service';
import { ApsCredentialsService } from 'app/core/services/aps-credentials/aps-credentials.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TableModule } from 'primeng/table';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { WebsocketService } from 'app/core/services/websocket/websocket.service';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { NgClass } from '@angular/common';
import { GtsConfirmationService } from '@gts/services/confirmation';
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';

@Component({
    selector: 'app-bim-data-import',
    templateUrl: './bim-data-import.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatButtonModule, MatIconModule, MatProgressSpinnerModule,
        TranslocoModule, TableModule, NgClass, NgxSpinnerModule
    ],
})
export class BimDataImportComponent implements OnInit, OnDestroy {

    @ViewChild('fileInput') fileInput!: ElementRef;
    private _subscription: Subscription = new Subscription();
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    files: any[] = [];

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _toastService: ToastService,
        private _spinner: NgxSpinnerService,
        private _translocoService: TranslocoService,
        private _gtsConfirmationService: GtsConfirmationService,
        private _apsCredentials: ApsCredentialsService,
        private _websocketService: WebsocketService,
        private _bimDataImportService: BimDataImportService,
    ) { }

    ngOnInit(): void {
        // Subscribe webSocket message
        this._subscription.add(
            this._websocketService.onMessage().subscribe({
                next: (res) => {
                    console.log(res)
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
        this._spinner.show()
        this._bimDataImportService.getObjects()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((data: any) => {
                data = this._calculateFileSize(data);
                this.files = data;
                this._spinner.hide();
                this._changeDetectorRef.markForCheck();
            });

        // this.files = this._bimDataImportService.files;
        // this._changeDetectorRef.markForCheck();
    }

    triggerFileInput(): void {
        this.fileInput.nativeElement.click();
    }

    onFileSelected(event: any): void {

        if (event.target.files) {
            const selectedFiles = this._calculateFileSize(event.target.files)

            // 合併檔案
            const newFiles = [
                ...selectedFiles.filter(selectedFile => {
                    const isDuplicate = this.files.some(existingFile => existingFile.name === selectedFile.name);

                    if (isDuplicate)
                        this._toastService.open({ message: `${selectedFile.name} ${this._translocoService.translate('already-exists')}.` });

                    return !isDuplicate;
                }),
                ...this.files,
            ];

            this.files = newFiles;

            // 重置 input 的值
            event.target.value = '';

            // console.log(this.files)
        }
    }

    onBimDataImport(file: any): void {

        if (!this._apsCredentials.check()) {
            this._toastService.open({ message: this._translocoService.translate('no-aps-credentials') });
            return;
        }

        if (file.status === 'ready') {
            this._bimDataImport(file);
        }
        else {
            const title = this._translocoService.translate('confirm-action');
            const message = this._translocoService.translate('re-translate-confirm');
            const deleteLabel = this._translocoService.translate('confirm');
            const cancelLabel = this._translocoService.translate('cancel');


            let dialogRef = this._gtsConfirmationService.open({
                title: title,
                message: message,
                icon: { color: 'primary' },
                actions: { confirm: { label: deleteLabel }, cancel: { label: cancelLabel } }

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
                        file.message = progress === 100 ? 'Saving file...' : `${progress} %`;
                        this._changeDetectorRef.markForCheck();
                    }
                },
                error: (err) => {
                    file.status = 'error';
                    file.message = JSON.stringify(err);
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
        console.log(file)
        this._bimDataImportService.bimDataReload(file.name)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (res) => {
                    file.status = 'process';                    
                },
                error: (err) => {
                    file.status = 'error';
                    file.message = JSON.stringify(err);
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
            const title = this._translocoService.translate('confirm-action');
            const message = this._translocoService.translate('delete-confirm');
            const deleteLabel = this._translocoService.translate('delete');
            const cancelLabel = this._translocoService.translate('cancel');


            let dialogRef = this._gtsConfirmationService.open({
                title: title,
                message: message,
                icon: { color: 'warn' },
                actions: { confirm: { label: deleteLabel }, cancel: { label: cancelLabel } }

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
        this._spinner.show()
        this._bimDataImportService.delete(file.name).pipe(
            finalize(() => {
                this._spinner.hide()
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



    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
        this._subscription.unsubscribe();
        this._websocketService.close();
    }
}
