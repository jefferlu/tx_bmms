import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { HttpEventType } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoModule } from '@jsverse/transloco';
import { BimDataImportService } from '../bim-data-import.service';
import { TableModule } from 'primeng/table';
import { ApsCredentialsService } from 'app/core/services/aps-credentials/aps-credentials.service';

@Component({
    selector: 'upload-object',
    templateUrl: './upload-object.component.html',
    styleUrl: './upload-object.component.scss',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule,
        TranslocoModule, MatProgressBarModule, TableModule
    ],
})
export class UploadObjectComponent implements OnInit, OnDestroy {

    @ViewChild('fileInput') fileInput!: ElementRef;

    canUpload: boolean = false;
    progress: number = 0;

    files: any[] = [];

    products;

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _bimDataImportService: BimDataImportService,
        private _apsCredentials: ApsCredentialsService
    ) { }

    ngOnInit(): void {
        // Start event stream
        this._bimDataImportService.sse('file')
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (data: any) => {
                    console.log('data', data)
                }
            });

        // Get objects
        // this._bimDataImportService.getObjects()
        //     .pipe(takeUntil(this._unsubscribeAll))
        //     .subscribe((data: any) => {
        //         console.log(data)
        //         // this.files = [...this._bimDataImportService.files, ...data];
        //         this._changeDetectorRef.markForCheck();
        //     });
        // this.files = this._bimDataImportService.files;
    }

    triggerFileInput(): void {
        this.fileInput.nativeElement.click();
    }

    onFileSelected(event: any): void {
        // this.fileInput = event.target;
        // this.page.files = event.target.files;

        if (event.target.files) {
            const selectedFiles = Array.from(event.target.files).map((file: any) => ({
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified,
                file: file
            }));

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
        }
    }

    onUpload(file: any): void {

        if (!this._apsCredentials.check()) {
            this._apsCredentials.open().afterClosed().subscribe(res => {
                if (res != 'confirmed') return;
                this._upload(file);
            });
        }
        else { this._upload(file); }
    }

    private _upload(file: any) {
        // this._bimDataImportService.sse('upload-object', file.name, this._apsCredentials.credientials)
        //     .pipe(takeUntil(this._unsubscribeAll))
        //     .subscribe({
        //         next: res => {

        //             console.log(res)

        //             file.status = JSON.parse(res.data).status;
        //             file.progress = JSON.parse(res.data).progress;

        //             // console.log(file.status, file.progress)
        //             console.log(JSON.parse(res.data))
        //             this._cdr.markForCheck();
        //         },
        //         error: err => {
        //             console.log('error', err)
        //         }
        //     });

        this._bimDataImportService.upload(file.file)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (res) => {
                    file.status = 'process';
                    if (res.type == HttpEventType.UploadProgress) {
                        let progress = Math.round(100 * (res.loaded / res.total));
                        console.log(progress)
                        // file.status = `${progress} %`;

                        // if (progress === 100) file.status = 'inprogress';
                        this._changeDetectorRef.markForCheck();
                    }

                },
                complete: () => {
                    // websocket emit upload-object
                }
            });
    }

    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
