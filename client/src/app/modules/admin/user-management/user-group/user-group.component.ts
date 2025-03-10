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
        MatProgressSpinnerModule, TranslocoModule, TableModule, MultiSelectModule,
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
        private _permissionService: PermissionService
    ) { }

    ngOnInit(): void {

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
                name: "圖資檢索模組",
                permissions: [
                    { codename: "view_process_function", name: "圖資檢索查詢", desc: "可查詢模型檢索列表資料" },
                ]
            },
            {
                name: "模型檢視模組",
                permissions: [
                    { codename: "view_bim_model", name: "3D模型檢視器", desc: "可使用 3D WebGL 模型檢視器" },
                    { codename: "manage_bim_model", name: "BIM 檔案管理", desc: "可管理並下載 BIM 檔案" }
                ]
            },
            {
                name: "文件管理模組",
                permissions: [
                    { codename: "manage_media_data", name: "數位化檔案", desc: "可管理數位化檔案並下載" },
                ]
            },
            {
                name: "模型匯入模組",
                permissions: [
                    { codename: "manage_data_import", name: "模型匯入作業", desc: "使用 APS 服務將模型轉換 WebGL 格式" }
                ]
            },
            {
                name: "使用者管理模組",
                permissions: [
                    { codename: "manage_users", name: "使用者管理", desc: "可新增、刪除、修改使用者帳戶" },
                    { codename: "manage_user_groups", name: "權限群組管理", desc: "可新增、刪除、修改使用者權限群組" },
                    { codename: "view_user_activity_log", name: "查詢使用者歷程", desc: "可查詢使用者歷程記錄並匯出記錄檔" }
                ]
            },
            {
                name: "系統管理模組",
                permissions: [                    
                    { codename: "manage_aps_credentials", name: "APS客戶端憑證", desc: "可進行資料庫備份及還原作業" },
                    { codename: "manage_backup_restore", name: "資料庫管理", desc: "可查詢系統記錄並匯出記錄檔" },
                    { codename: "view_system_activity_log", name: "查看系統活動日誌", desc: "可修改 APS 客戶端憑證資料" }
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

    ngOnDestroy(): void {

    }
}
