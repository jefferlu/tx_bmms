import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FuseValidators } from '@fuse/validators';
import { Subject } from 'rxjs';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { TranslocoModule } from '@jsverse/transloco';
import { UserAccountService } from '../user-account.service';

@Component({
    selector: 'app-user-dialog',
    templateUrl: './user-dialog.component.html',
    styleUrl: './user-dialog.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        FormsModule, ReactiveFormsModule,
        MatInputModule, MatIconModule, MatFormFieldModule,
        MatSelectModule, MatButtonModule, MatDialogModule,
        TranslocoModule
    ],
})
export class UserDialogComponent implements OnInit, OnDestroy {

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    form: UntypedFormGroup;
    roles: any[];
    user: any;

    constructor(
        @Inject(MAT_DIALOG_DATA) private _data: any,
        private _formBuilder: UntypedFormBuilder,
        private _matDialogRef: MatDialogRef<UserDialogComponent>,
        private _toastService: ToastService,
        private _userAccountService: UserAccountService
    ) { }

    ngOnInit(): void {

        this.user = this._data.user;

        if (!this.user.is_staff) this.user.is_staff = false;

        // Setup the roles
        this.roles = [
            {
                label: 'Admin',
                value: true,
            }, {
                label: 'User',
                value: false,
            }
        ];

        this.form = this._formBuilder.group({
            username: [this.user.username, []],
            email: [this.user.email || '', [Validators.email, Validators.required]],
            is_staff: [this.user.is_staff],
            password: [''],
            password2: [''],
        }, { validators: FuseValidators.mustMatch('password', 'password2') });

        // 控制密碼欄位是否必填
        if (!this.user.id) {
            this.form.get('password').setValidators([Validators.required]);
            this.form.get('password2').setValidators([Validators.required]);
            // 更新表單
            this.form.get('password').updateValueAndValidity();
            this.form.get('password2').updateValueAndValidity();
        }
    }

    onSave(): void {

        let request: any;
        if (this.form.invalid) return;

        // Update user
        if (this.user.id) {
            request = {
                id: this.user.id,
                username: this.form.get('username').value,
                email: this.form.get('email').value,
                is_staff: this.form.get('is_staff').value
            };

            if (this.form.get('password').value)
                request.password = this.form.get('password').value

            this._userAccountService.update(request).subscribe({
                next: (res) => {
                    if (res) {
                        this._toastService.open({ message: 'The user has been updated.' });
                        this._matDialogRef.close();
                    }
                }
            });
        }

        // Create user
        else {
            request = this.form.value;
            this._userAccountService.create(this.form.value).subscribe({
                next: (res) => {
                    if (res) {
                        this._toastService.open({ message: 'The user has been created.' });
                        this._matDialogRef.close();
                    }
                }
            });
        }
    }

    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
