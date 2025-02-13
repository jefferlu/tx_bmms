import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, ViewEncapsulation } from '@angular/core';
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
export class ApsCredentialsComponent implements OnInit {

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    data: any;
    form: UntypedFormGroup;

    constructor(
        private _formBuilder: UntypedFormBuilder,
        private _translocoService: TranslocoService,
        private _toastService: ToastService,
        private _apsCredentialsService: ApsCredentialsService
    ) { }

    ngOnInit(): void {
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
        console.log(request, this.data)
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
}