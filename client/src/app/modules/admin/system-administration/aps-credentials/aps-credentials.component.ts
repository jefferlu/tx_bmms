import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { finalize, Subject, takeUntil, merge } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule, TranslocoService, TranslocoEvents } from '@jsverse/transloco';
import { ApsCredentialsService } from './aps-credentials.service';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { BreadcrumbService } from 'app/core/services/breadcrumb/breadcrumb.service';
import { filter, map, distinctUntilChanged } from 'rxjs/operators';


@Component({
    selector: 'aps-credentials',
    templateUrl: './aps-credentials.component.html',
    styleUrl: './aps-credentials.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule, ReactiveFormsModule, TranslocoModule,
        MatButtonModule, MatIconModule, MatDialogModule, MatFormFieldModule, MatInputModule
    ],
})
export class ApsCredentialsComponent implements OnInit, OnDestroy {

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    data: any;
    form: UntypedFormGroup;

    constructor(
        private _formBuilder: UntypedFormBuilder,
        private _translocoService: TranslocoService,
        private _toastService: ToastService,
        private _apsCredentialsService: ApsCredentialsService,
        private _breadcrumbService: BreadcrumbService
    ) { }

    ngOnInit(): void {
        // 初始化 breadcrumb
        this.updateBreadcrumb();

        // 同時監聽語系切換和翻譯文件加載完成事件
        // langChanges$: 當用戶切換語系時立即更新
        // translationLoadSuccess: 當翻譯文件首次加載完成時更新
        merge(
            this._translocoService.langChanges$,
            this._translocoService.events$.pipe(
                filter(e => e.type === 'translationLoadSuccess'),
                map(() => this._translocoService.getActiveLang())
            )
        ).pipe(
            distinctUntilChanged(),
            takeUntil(this._unsubscribeAll)
        ).subscribe(() => {
            this.updateBreadcrumb();
        });
