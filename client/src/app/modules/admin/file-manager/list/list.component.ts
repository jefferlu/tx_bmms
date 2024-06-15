import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FileManagerService } from '../file-manager.service';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { HttpEventType } from '@angular/common/http';
import { finalize } from 'rxjs';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
    selector: 'file-manager-list',
    templateUrl: './list.component.html',
    styleUrl: './list.component.scss',
    standalone: true,
    imports: [
        CommonModule, RouterOutlet, TranslocoModule,
        MatSidenavModule, MatButtonModule, MatIconModule, MatStepperModule, MatFormFieldModule,
        MatInputModule, MatProgressBarModule]
})
export class FileManagerListComponent implements OnInit, OnDestroy {

    @ViewChild(MatStepper) stepper: MatStepper;
    @ViewChild('content') logContent: ElementRef;

    form: UntypedFormGroup;
    fileInput: any;
    fileName: string;

    progress: number = 0;
    oss_progress: number = 0;
    translate_progress: string = '';

    isStartUpload: boolean = false;
    isStartUploadOSS: boolean = false;
    isStartTranslate: boolean = false;
    isStartConvert: boolean = false;
    isDone: boolean = false;

    canUpload: boolean = false;


    extractMessages: any[] = [];
    error: any;

    constructor(
        private _formBuilder: UntypedFormBuilder,
        private _cdr: ChangeDetectorRef,
        private _fileManagerService: FileManagerService,

    ) { }

    ngOnInit(): void {

        this.form = this._formBuilder.group({
            file: [''],
            message: ['']

        });
    }

    onFileSelected(event: any): void {
        this.fileInput = event.target;

        this.form.patchValue({ file: '' });
        if (this.fileInput.files && this.fileInput.files.length > 0) {

            // 將選擇的文件名顯示在 mat-input 中
            this.form.patchValue({ file: this.fileInput.files[0].name });
            this.fileName = this.fileInput.files[0].name;

            this.canUpload = true;
        }
    }

    onStartUpload(): void {

        this.isStartUpload = true;
        this.canUpload = false;
        this.form.patchValue({ message: '' });

        this._fileManagerService.uploadFile(this.fileInput.files[0])
            .subscribe({
                next: (res) => {
                    if (res.type == HttpEventType.UploadProgress) {
                        this.progress = Math.round(100 * (res.loaded / res.total));
                        this._cdr.markForCheck();
                        console.log(res.loaded, res.total)
                    }

                },
                complete: () => {
                    // websocket emit upload-object
                    this.isStartUploadOSS = true;
                    this._cdr.markForCheck();
                    // this._fileManagerService.uploadObject(this.fileName);
                }
            });

    }

    onTranslateJob() {
        // this.isStartTranslate = true;
        // this._fileManagerService.clearTranslateJob();
        // this._fileManagerService.translate(this.fileName);
    }

    onExtraMetadata() {
        this.isStartConvert = true;
        // this._fileManagerService.extract(this.fileName)
    }

    onDone() {
        this.reset();
    }

    reset() {
        this.progress = 0
        this.oss_progress = 0;
        this.isStartUpload = false;
        this.isStartUploadOSS = false;
        this.isStartTranslate = false;
        this.isStartConvert = false;
        this.isDone = false;

        this.extractMessages = [];
        this.error = null;

        this.stepper.reset();
        this.form.reset();
    }


    private scrollToBottom(): void {
        this.logContent.nativeElement.scrollTop = this.logContent.nativeElement.scrollHeight;
    }

    ngOnDestroy(): void {
        // this._fileManagerService.closeSocket();
    }
}
