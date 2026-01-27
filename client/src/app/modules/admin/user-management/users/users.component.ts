import { DatePipe, NgClass, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormsModule, NgForm, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { TableModule } from 'primeng/table';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { BreadcrumbService } from 'app/core/services/breadcrumb/breadcrumb.service';
import { finalize, Subject, takeUntil } from 'rxjs';
import { UsersService } from './users.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { MultiSelectModule } from 'primeng/multiselect';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { GtsMediaWatcherService } from '@gts/services/media-watcher';
import { GtsConfirmationService } from '@gts/services/confirmation';
import { GtsValidators } from '@gts/validators';
import { GtsMapByName } from '@gts/pipes/map-by-name.pipe';
import { UserGroupService } from '../user-group/user-group.service';

@Component({
    selector: 'users',
    templateUrl: './users.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgTemplateOutlet, FormsModule, ReactiveFormsModule, DatePipe,
        MatInputModule, MatIconModule, MatFormFieldModule, MatSelectModule, MatDividerModule,
        MatSidenavModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatCheckboxModule,
        MatProgressSpinnerModule, TranslocoModule, TableModule, MultiSelectModule, GtsMapByName
    ],
})
export class UsersComponent implements OnInit, OnDestroy {

    @ViewChild('matDrawer', { static: true }) matDrawer: MatDrawer;
    @ViewChild('ngForm') ngForm: NgForm;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    drawerMode: 'side' | 'over';

    form: UntypedFormGroup;

    page: any = {
        data: null,
        groupData: [],
        record: {},
    };

    isLoading: boolean;

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _formBuilder: UntypedFormBuilder,
        private _gtsMediaWatcherService: GtsMediaWatcherService,
        private _gtsConfirmationService: GtsConfirmationService,
        private _toastService: ToastService,
        private _translocoService: TranslocoService,
        private _groupsService: UserGroupService,
        private _usersService: UsersService,
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

        this._gtsMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                // Set the drawerMode if the given breakpoint is active
                if (matchingAliases.includes('lg')) {
                    this.drawerMode = 'side';
                } else {
                    this.drawerMode = 'over';
                }

                // Mark for check
                this._changeDetectorRef.markForCheck();
            });

        // Get groups data
        this._groupsService.data$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((data: any) => {
                this.page.groupData = data;
            });

        // Get users data
        this._usersService.data$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((data: any) => {
                this.page.data = data;
            });

        // Data form
        this.form = this._formBuilder.group({
            username: ['', [Validators.required]],
            email: ['', [Validators.required, Validators.email]],
            // groups_obj: [[this.page.groupData[0]]],  //寫入預設值
            groups_obj: [],
            is_superuser: [],
            password: [''],
            password2: [''],
        }, { validators: GtsValidators.mustMatch('password', 'password2') });
    }

    onOpenDrawer(event?: any) {

        this.page.record = event?.data || {};

        // update 
        if (this.page.record.id) {
            this.form.patchValue(this.page.record);

            this.form.patchValue({ password: '' })
            this.form.patchValue({ password2: '' })
            this.form.get('password').setValidators([]);
            this.form.get('password2').setValidators([]);
        }

        // create
        else {
            this.ngForm.resetForm();

            // 新增值狀態預設值
            this.form.patchValue({ is_superuser: false })
            // this.form.patchValue({ groups_obj: [this.page.groupData[0]] });  

            this.form.get('password').setValidators([Validators.required]);
            this.form.get('password2').setValidators([Validators.required]);
        }

        // 更新表單
        this.form.get('password').updateValueAndValidity();
        this.form.get('password2').updateValueAndValidity();

        this.matDrawer.open();
        this._changeDetectorRef.markForCheck();
    }

    onSave(): void {

        let request: any;
        if (this.form.invalid) return;

        if (!this.form.get('groups_obj')?.value){
            this._toastService.open({ message: this._translocoService.translate('need-groups') });
            return;
        }


        this.isLoading = true;
        // Update
        if (this.page.record.id) {
            request = {
                id: this.page.record.id,
                username: this.form.get('username').value,
                email: this.form.get('email').value,
                is_superuser: this.form.get('is_superuser').value,
                groups: (this.form.get('groups_obj')?.value || []).map((e: any) => e.id)
            };

            if (this.form.get('password').value)
                request.password = this.form.get('password').value

            this._usersService.update(request).pipe(
                finalize(() => {
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                })
            ).subscribe({
                next: (res) => {
                    if (res) {
                        this._toastService.open({ message: this._translocoService.translate('update-success') });
                    }
                }
            });
        }

        // Create
        else {
            request = this.form.value;
            request.groups = (this.form.get('groups_obj')?.value || []).map((e: any) => e.id);

            this._usersService.create(request).pipe(
                finalize(() => {
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                })
            ).subscribe({
                next: (res) => {
                    if (res) {
                        this.ngForm.resetForm();
                        this._toastService.open({ message: this._translocoService.translate('create-success') });
                    }
                }
            });
        }
    }

    onDelete(): void {

        const title = this._translocoService.translate('confirm-action');
        const message = this._translocoService.translate('delete-confirm');
        const deleteLabel = this._translocoService.translate('delete');
        const cancelLabel = this._translocoService.translate('cancel');


        let dialogRef = this._gtsConfirmationService.open({
            title: title,
            message: message,
            icon: { color: 'warn' },
            actions: { confirm: { label: deleteLabel, color: 'warn' }, cancel: { label: cancelLabel } }

        });

        dialogRef.afterClosed().subscribe(result => {
            if (result === 'confirmed') {
                this.delete();
                this._changeDetectorRef.markForCheck();
            }
        });
    }

    delete(): void {
        this.isLoading = true;
        this._usersService.delete(this.page.record.id).pipe(
            finalize(() => {
                this.isLoading = false;
                this._changeDetectorRef.markForCheck();
                this.onCloseDrawer();
            })
        ).subscribe({
            next: (res) => {
                this._toastService.open({ message: this._translocoService.translate('delete-success') });
            }
        });
    }

    onCloseDrawer() {
        this.matDrawer.close();
        this._changeDetectorRef.markForCheck();
    }

    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    // 更新 breadcrumb
    private updateBreadcrumb(): void {
        this._breadcrumbService.setBreadcrumb([
            {
                label: this._translocoService.translate('user-management')
            },
            {
                label: this._translocoService.translate('user')
            }
        ]);
    }

    ngOnDestroy(): void {
        this._breadcrumbService.clear();
        // Unsubscribe from all subscriptions
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
