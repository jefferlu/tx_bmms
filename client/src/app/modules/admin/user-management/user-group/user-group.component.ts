import { DatePipe, NgClass, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormsModule, NgForm, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { finalize, Subject, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { MultiSelectModule } from 'primeng/multiselect';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TableModule } from 'primeng/table';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

import { GtsMediaWatcherService } from '@gts/services/media-watcher';
import { GtsConfirmationService } from '@gts/services/confirmation';
import { GtsValidators } from '@gts/validators';
import { GtsMapByName } from '@gts/pipes/map-by-name.pipe';
import { PermissionService, UserGroupService } from './user-group.service';
import { BreadcrumbService } from 'app/core/services/breadcrumb/breadcrumb.service';

@Component({
    selector: 'app-user-group',
    templateUrl: './user-group.component.html',
    styleUrl: './user-group.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgTemplateOutlet, FormsModule, ReactiveFormsModule, ToggleSwitchModule,
        MatInputModule, MatIconModule, MatFormFieldModule, MatSelectModule, MatDividerModule,
        MatSidenavModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatCheckboxModule,
        MatProgressSpinnerModule, TranslocoModule, TableModule, MultiSelectModule
    ],
})
export class UserGroupComponent implements OnInit, OnDestroy {
    @ViewChild('matDrawer', { static: true }) matDrawer: MatDrawer;
    @ViewChild('ngForm') ngForm: NgForm;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    drawerMode: 'side' | 'over';

    form: any = {

    }

    page: any = {
        name: null,
        data: null,
        permissions: null,
        restruct: null,
        record: null,
    };

    isLoading: boolean;

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _formBuilder: UntypedFormBuilder,
        private _gtsMediaWatcherService: GtsMediaWatcherService,
        private _gtsConfirmationService: GtsConfirmationService,
        private _toastService: ToastService,
        private _translocoService: TranslocoService,
        private _userGroupService: UserGroupService,
        private _permissionService: PermissionService,
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

        // Get group data
        this._userGroupService.data$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((data: any) => {
                this.page.data = data;
            });

        // Get permission data
        this._permissionService.data$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((data: any) => {
                this.page.permissions = data;
                this._managePermission();
            });

        // Listen to language changes and update permissions
        this._translocoService.langChanges$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => {
                if (this.page.permissions) {
                    this._managePermission();
                    this._changeDetectorRef.markForCheck();
                }
            });
    }

    onOpenDrawer(event?: any) {

        this.page.record = event?.data || {};
        this.page.name = this.page.record.name;

        // Create
        if (!this.page.record.id) {
            this.page.record = {};
        }

        if (Object.keys(this.page.record).length === 0) {
            // 如果 this.page.record 是空的，表示為新增資料
            this.page.restruct.forEach(r => {
                r.permissions.forEach(permission => {
                    permission.status = false; // 設置所有權限的 status 為 false
                });
            });
        } else {
            // 如果 this.page.record 不為空，則根據後端資料設置權限的狀態
            this.page.restruct.forEach(r => {
                r.permissions.forEach(permission => {
                    const permissionFromGroup = this.page.record.permissions.find((p: any) => p.codename === permission.codename);
                    if (permissionFromGroup) {
                        permission.status = true; // 如果權限在 group 中找到，設置為 true
                    } else {
                        permission.status = false;
                    }
                });
            });
        }
        this._changeDetectorRef.markForCheck();
        console.log(this.page.restruct)
        
        this.matDrawer.open();
        
    }

    onCloseDrawer() {
        this.matDrawer.close();
        this._changeDetectorRef.markForCheck();
    }

    onSave(): void {


        let request: any;

        const permissions = this.page.restruct.flatMap((group: any) =>
            group.permissions.filter(permission => permission.status === true)
        );

        console.log(this.page.record)

        this.isLoading = true;
        // Update
        if (this.page.record.id) {
            request = {
                id: this.page.record.id,
                name: this.page.name,
                permissions: permissions
            };

            this._userGroupService.update(request).pipe(
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
            request = {
                name: this.page.name,
                permissions: permissions
            };

            this._userGroupService.create(request).pipe(
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
        this._userGroupService.delete(this.page.record.id).pipe(
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

    private _managePermission() {
        const category = [
            {
                name: `${this._translocoService.translate('bim-information-listing')}`,
                permissions: [
                    { codename: "view_process_function", name: this._translocoService.translate('bim-information-search'), desc: this._translocoService.translate('bim-information-search-desc') },
                ]
            },
            {
                name: `${this._translocoService.translate('bim-model-viewer')}`,
                permissions: [
                    { codename: "view_bim_model", name: this._translocoService.translate('3d-model-viewer'), desc: this._translocoService.translate('3d-model-viewer-desc') },
                    { codename: "manage_bim_model", name: this._translocoService.translate('bim-file-management'), desc: this._translocoService.translate('bim-file-management-desc') }
                ]
            },
            {
                name: `${this._translocoService.translate('digital-files')}`,
                permissions: [
                    { codename: "manage_media_data", name: this._translocoService.translate('digital-files'), desc: this._translocoService.translate('digital-files-desc') },
                ]
            },
            {
                name: `${this._translocoService.translate('bim-data-import')}`,
                permissions: [
                    { codename: "manage_data_import", name: this._translocoService.translate('model-import-operations'), desc: this._translocoService.translate('model-import-operations-desc') }
                ]
            },
            {
                name: `${this._translocoService.translate('user-management')}`,
                permissions: [
                    { codename: "manage_users", name: this._translocoService.translate('user-management'), desc: this._translocoService.translate('user-management-desc') },
                    { codename: "manage_user_groups", name: this._translocoService.translate('permission-group-management'), desc: this._translocoService.translate('permission-group-management-desc') },
                    { codename: "view_user_activity_log", name: this._translocoService.translate('user-log-query'), desc: this._translocoService.translate('user-log-query-desc') }
                ]
            },
            {
                name: `${this._translocoService.translate('system-administration')}`,
                permissions: [
                    { codename: "manage_aps_credentials", name: this._translocoService.translate('aps-account'), desc: this._translocoService.translate('aps-account-desc') },
                    { codename: "manage_backup_restore", name: this._translocoService.translate('database-management'), desc: this._translocoService.translate('database-management-desc') },
                    { codename: "view_system_activity_log", name: this._translocoService.translate('system-log-query'), desc: this._translocoService.translate('system-log-query-desc') }
                ]
            }
        ]

        const permissionsDict = this.page.permissions.reduce((acc, permission) => {
            acc[permission.codename] = permission.id;
            return acc;
        }, {});

        this.page.restruct = category.map(r => {
            return {
                name: r.name,
                permissions: r.permissions.map(permission => {
                    // 根據 codename 查找對應的 id
                    const permissionId = permissionsDict[permission.codename];
                    return {
                        ...permission,
                        id: permissionId
                    };
                })
            };
        });
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
                label: this._translocoService.translate('role')
            }
        ]);
    }

    ngOnDestroy(): void {
        this._breadcrumbService.clear();
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
