import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { finalize, Subject, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ApsCredentialsService } from './aps-credentials.service';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { BreadcrumbService } from 'app/core/services/breadcrumb/breadcrumb.service';


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

        // 監聽語系變化以更新 breadcrumb
        this._translocoService.langChanges$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => {
                this.updateBreadcrumb();
            });

        this._apsCredentialsService.getData()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((data: any) => {
                this.data = data[0];
                this.form.patchValue({
                    client_id: data[0].client_id,
                    client_secret: data[0].client_secret
                })
            })

        this.form = this._formBuilder.group({
            client_id: ['', Validators.required],
            client_secret: ['', Validators.required],
        });
    }

    onSave(): void {

        if (this.form.invalid) return;

        let request = this.form.value;
        
        // Update
        if (this.data.id) {
            request.id = this.data.id;
            request.company=this.data.company;

            this._apsCredentialsService.update(request).pipe(
                finalize(() => {
                })
            ).subscribe({
                next: (res) => {
                    if (res) {
                        this._toastService.open({ message: this._translocoService.translate('update-success') });
                    }
                }
            });
        }
    }

    // 更新 breadcrumb
    private updateBreadcrumb(): void {
        this._breadcrumbService.setBreadcrumb([
            {
                label: this._translocoService.translate('system-administration')
            },
            {
                label: this._translocoService.translate('aps-account')
            }
        ]);
    }

    ngOnDestroy(): void {
        this._breadcrumbService.clear();
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}