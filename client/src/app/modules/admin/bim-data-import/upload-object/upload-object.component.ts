import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
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
        TranslocoModule, MatProgressBarModule
    ],
})
export class UploadObjectComponent implements OnInit, OnDestroy {

    canUpload: boolean = false;
    progress: number = 0;
    files = [];


    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _cdr: ChangeDetectorRef,
        private _bimDataImportService: BimDataImportService
    ) { }

    ngOnInit(): void {

    }

    onFileSelected(event: any): void {
        // this.fileInput = event.target;
        this.files = event.target.files

        // this.form.patchValue({ file: '' });
        // if (this.fileInput.files && this.fileInput.files.length > 0) {

        //     // 將選擇的文件名顯示在 mat-input 中
        //     this.form.patchValue({ file: this.fileInput.files[0].name });

        //     this.canUpload = true;
        // }
    }

    onUpload(file: any): void {

        this._bimDataImportService.uploadFile(file)
            .subscribe({
                next: (res) => {
                    if (res.type == HttpEventType.UploadProgress) {
                        let progress = Math.round(100 * (res.loaded / res.total));
                        file.status = `${progress} %`;

                        if (progress === 100) file.status = 'inprogress';
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
