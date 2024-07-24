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

    files: any[];

    products;

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _cdr: ChangeDetectorRef,
        private _bimDataImportService: BimDataImportService,
        private _apsCredentials: ApsCredentialsService
    ) { }

    ngOnInit(): void { }

    triggerFileInput(): void {
        this.fileInput.nativeElement.click();
    }

    onFileSelected(event: any): void {
        // this.fileInput = event.target;
        // this.page.files = event.target.files;

        if (event.target.files) {
            this.files = Array.from(event.target.files).map((file: any) => ({
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified,
                file: file
            }));
        }

        // this.page.files = event.target.files;

        // this.form.patchValue({ file: '' });
        // if (this.fileInput.files && this.fileInput.files.length > 0) {

        //     // 將選擇的文件名顯示在 mat-input 中
        //     this.form.patchValue({ file: this.fileInput.files[0].name });

        //     this.canUpload = true;
        // }


        console.log(this.files, event.target.files)
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
        this._bimDataImportService.uploadFile(file.file)
            .subscribe({
                next: (res) => {

                    file.status = 'process';
                    if (res.type == HttpEventType.UploadProgress) {
                        let progress = Math.round(100 * (res.loaded / res.total));
                        // file.status = `${progress} %`;

                        // if (progress === 100) file.status = 'inprogress';
                        this._cdr.markForCheck();
                    }

                },
                complete: () => {
                    // websocket emit upload-object

                    this._bimDataImportService.sse('upload-object', file.name)
                        .pipe(takeUntil(this._unsubscribeAll))
                        .subscribe(res => {

                            file.status = JSON.parse(res.data).status;
                            file.progress = JSON.parse(res.data).progress;

                            console.log(file.status, file.progress)
                            this._cdr.markForCheck();
                        });
                }
            });
    }

    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    ngOnDestroy(): void {
        // Unsubscribe from all subscriptions
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
