import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TableModule } from 'primeng/table';
import { BimDataImportService } from './bim-data-import.service';
import { ApsCredentialsService } from 'app/core/services/aps-credentials/aps-credentials.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { HttpEventType } from '@angular/common/http';
import { WebsocketService } from 'app/core/services/websocket.service';

@Component({
    selector: 'app-bim-data-import',
    templateUrl: './bim-data-import.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatButtonModule, MatIconModule, MatProgressSpinnerModule,
        TranslocoModule, TableModule
    ],
})
export class BimDataImportComponent implements OnInit, OnDestroy {

    @ViewChild('fileInput') fileInput!: ElementRef;
    private _subscription: Subscription = new Subscription();
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    files: any[] = [];

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _apsCredentials: ApsCredentialsService,
        private _websocketService: WebsocketService,
        private _bimDataImportService: BimDataImportService,
    ) { }

    ngOnInit(): void {
        // 訂閱 WebSocket 訊息
        this._subscription.add(
            this._websocketService.onMessage().subscribe({
                next: (res) => {
                    console.log(res)

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

                    console.log(this.files);
                    this._changeDetectorRef.markForCheck();                    
                },
                error: (err) => console.error('WebSocket error:', err),
                complete: () => console.log('WebSocket connection closed.'),
            })
        );
    }

    triggerFileInput(): void {
        this.fileInput.nativeElement.click();
    }

    onFileSelected(event: any): void {
        if (event.target.files) {
            const selectedFiles = Array.from(event.target.files).map((file: any) => {
                const sizeInMB = file.size / (1024 * 1024); // 轉換為 MB/GB
                const size = sizeInMB >= 1000
                    ? `${(sizeInMB / 1024).toFixed(2)} GB`
                    : `${sizeInMB.toFixed(2)} MB`;

                return {
                    name: file.name,
                    size: size, // 動態決定單位
                    type: file.type,
                    lastModified: file.lastModified,
                    status: 'ready', // 新增 status 屬性
                    message: '',
                    file: file
                };
            });


            // 從 BimDataImportService 中獲取現有檔案列表
            const existingFiles = this._bimDataImportService.files || [];
            // const existingFiles = this.files || [];

            // 合併檔案
            const newFiles = [
                ...existingFiles,
                ...selectedFiles.filter(selectedFile =>
                    !existingFiles.some(existingFile => existingFile.name === selectedFile.name)
                )
            ];

            this._bimDataImportService.files = newFiles;
            this.files = newFiles;

            console.log(this.files)
        }
    }

    onBimDataImport(file: any): void {

        // if (!this._apsCredentials.check()) {
        if (!this._apsCredentials.check()) {
            this._apsCredentials.open().afterClosed().subscribe(res => {
                if (res != 'confirmed') return;
                this._bimDataImport(file);
            });
        }
        else { this._bimDataImport(file); }
    }

    private _bimDataImport(file: any) {
        this._bimDataImportService.bimDataInport(file.file)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (res) => {
                    file.status = 'process';
                    if (res.type == HttpEventType.UploadProgress) {
                        let progress = Math.round(100 * (res.loaded / res.total));
                        console.log(progress)
                        file.status = "uploading"
                        file.message = `${progress} %`;
                        this._changeDetectorRef.markForCheck();
                    }
                },
                complete: () => {
                    file.status = "completed"
                    file.message = 'upload-completed'
                    console.log('upload-completed')
                    this._changeDetectorRef.markForCheck();
                }
            });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
        this._subscription.unsubscribe();
        this._websocketService.close();
    }
}
