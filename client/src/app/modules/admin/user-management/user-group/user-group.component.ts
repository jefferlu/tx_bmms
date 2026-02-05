import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, Subject, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { TableModule } from 'primeng/table';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';

import { GtsConfirmationService } from '@gts/services/confirmation';
import { PermissionService, UserGroupService } from './user-group.service';
import { BreadcrumbService } from 'app/core/services/breadcrumb/breadcrumb.service';

interface PermissionDef {
    codename: string;
    name: string;
    id?: number;
}

interface GroupRow {
    id?: number;
    tempId?: string;  // 用於新增行的唯一識別
    name: string;
    permissions: { [codename: string]: boolean };
    isNew?: boolean;
    isEditing?: boolean;
}

@Component({
    selector: 'app-user-group',
    templateUrl: './user-group.component.html',
    styleUrl: './user-group.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgClass, FormsModule,
        MatInputModule, MatIconModule, MatFormFieldModule,
        MatButtonModule, MatProgressSpinnerModule,
        TranslocoModule, TableModule, CheckboxModule, InputTextModule
    ],
})
export class UserGroupComponent implements OnInit, OnDestroy {
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    // 權限定義列表 (作為表格欄位)
    permissionColumns: PermissionDef[] = [];

    // 權限資料（從後端獲取）
    permissionsData: any[] = [];

    // 群組資料列表
    groups: GroupRow[] = [];

    // 多選刪除相關
    selectedGroups: GroupRow[] = [];

    // 載入狀態
    isLoading: boolean = false;
    isSaving: { [id: string]: boolean } = {};

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
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
                this._initPermissionColumns();
                this._changeDetectorRef.markForCheck();
            });

        // Get permission data first
        this._permissionService.data$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((data: any) => {
                this.permissionsData = data || [];
                this._initPermissionColumns();
            });

        // Get group data
        this._userGroupService.data$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((data: any) => {
                this._buildGroupRows(data || []);
            });
    }

    /**
     * 初始化權限欄位定義
     */
    private _initPermissionColumns(): void {
        const permissionDefs: PermissionDef[] = [
            { codename: 'view_process_function', name: this._translocoService.translate('bim-information-search') },
            { codename: 'view_bim_model', name: this._translocoService.translate('3d-model-viewer') },
            { codename: 'manage_bim_model', name: this._translocoService.translate('bim-file-management') },
            { codename: 'manage_media_data', name: this._translocoService.translate('digital-files') },
            { codename: 'manage_data_import', name: this._translocoService.translate('model-import-operations') },
            { codename: 'manage_users', name: this._translocoService.translate('user-management') },
            { codename: 'manage_user_groups', name: this._translocoService.translate('permission-group-management') },
            { codename: 'view_user_activity_log', name: this._translocoService.translate('user-log-query') },
            { codename: 'manage_aps_credentials', name: this._translocoService.translate('aps-account') },
            { codename: 'manage_backup_restore', name: this._translocoService.translate('database-management') },
            { codename: 'view_system_activity_log', name: this._translocoService.translate('system-log-query') }
        ];

        // 將後端的 permission id 對應到定義中
        const permissionsDict = this.permissionsData.reduce((acc, p) => {
            acc[p.codename] = p.id;
            return acc;
        }, {});

        this.permissionColumns = permissionDefs.map(def => ({
            ...def,
            id: permissionsDict[def.codename]
        }));
    }

    /**
     * 根據後端資料建立群組行
     * 保留正在編輯中的 row 的狀態和資料
     */
    private _buildGroupRows(data: any[]): void {
        // 保存新增中的 row（尚未儲存到後端）
        const newRows = this.groups.filter(g => g.isNew);

        // 建立後端資料的 row
        const updatedGroups = data.map(group => {
            // 檢查這個 group 是否正在被編輯
            const existingGroup = this.groups.find(g => g.id === group.id);
            if (existingGroup && existingGroup.isEditing) {
                // 保留編輯中的狀態和資料
                return existingGroup;
            }

            // 非編輯中的 row，用後端資料建立
            const permissions: { [codename: string]: boolean } = {};

            // 初始化所有權限為 false
            this.permissionColumns.forEach(col => {
                permissions[col.codename] = false;
            });

            // 根據群組的權限設定為 true
            if (group.permissions) {
                group.permissions.forEach((p: any) => {
                    if (permissions.hasOwnProperty(p.codename)) {
                        permissions[p.codename] = true;
                    }
                });
            }

            return {
                id: group.id,
                name: group.name,
                permissions,
                isNew: false,
                isEditing: false
            };
        });

        // 合併：新增中的 row 放在最前面
        this.groups = [...newRows, ...updatedGroups];

        this._changeDetectorRef.markForCheck();
    }

    /**
     * 新增一筆群組
     */
    onAddGroup(): void {
        const permissions: { [codename: string]: boolean } = {};
        this.permissionColumns.forEach(col => {
            permissions[col.codename] = false;
        });

        const newGroup: GroupRow = {
            tempId: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            name: '',
            permissions,
            isNew: true,
            isEditing: true
        };

        // 加到列表最前面
        this.groups = [newGroup, ...this.groups];
        this._changeDetectorRef.markForCheck();
    }

    /**
     * 儲存群組（新增或更新）
     */
    onSaveGroup(group: GroupRow): void {
        if (!group.name || group.name.trim() === '') {
            this._toastService.open({
                message: this._translocoService.translate('name-required')
            });
            return;
        }

        // 收集啟用的權限
        const enabledPermissions = this.permissionColumns
            .filter(col => group.permissions[col.codename])
            .map(col => ({ id: col.id, codename: col.codename }));

        // 使用 id 或 tempId 作為唯一的 saveKey
        const saveKey = group.id ? group.id.toString() : group.tempId;
        this.isSaving[saveKey] = true;
        this._changeDetectorRef.markForCheck();

        if (group.id) {
            // 更新
            const request = {
                id: group.id,
                name: group.name,
                permissions: enabledPermissions
            };

            this._userGroupService.update(request).pipe(
                finalize(() => {
                    this.isSaving[saveKey] = false;
                    this._changeDetectorRef.markForCheck();
                })
            ).subscribe({
                next: (res) => {
                    if (res) {
                        group.isEditing = false;
                        this._toastService.open({
                            message: this._translocoService.translate('update-success')
                        });
                    }
                }
            });
        } else {
            // 新增
            const request = {
                name: group.name,
                permissions: enabledPermissions
            };

            this._userGroupService.create(request).pipe(
                finalize(() => {
                    this.isSaving[saveKey] = false;
                    this._changeDetectorRef.markForCheck();
                })
            ).subscribe({
                next: (res: any) => {
                    if (res) {
                        group.id = res.id;
                        group.isNew = false;
                        group.isEditing = false;
                        this._toastService.open({
                            message: this._translocoService.translate('create-success')
                        });
                    }
                }
            });
        }
    }

    /**
     * 取消編輯（針對新增的行直接移除）
     */
    onCancelEdit(group: GroupRow, index: number): void {
        if (group.isNew) {
            this.groups.splice(index, 1);
            this.groups = [...this.groups];
        } else {
            group.isEditing = false;
        }
        this._changeDetectorRef.markForCheck();
    }

    /**
     * 開始編輯群組
     */
    onEditGroup(group: GroupRow): void {
        group.isEditing = true;
        this._changeDetectorRef.markForCheck();
    }

    /**
     * 單筆刪除
     */
    onDeleteGroup(group: GroupRow, index: number): void {
        // 如果是新增但尚未儲存的行，直接移除
        if (group.isNew) {
            this.groups.splice(index, 1);
            this.groups = [...this.groups];
            this._changeDetectorRef.markForCheck();
            return;
        }

        const dialogRef = this._gtsConfirmationService.open({
            title: this._translocoService.translate('confirm-action'),
            message: this._translocoService.translate('delete-confirm'),
            icon: { color: 'warn' },
            actions: {
                confirm: { label: this._translocoService.translate('delete'), color: 'warn' },
                cancel: { label: this._translocoService.translate('cancel') }
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result === 'confirmed') {
                this._deleteGroup(group);
            }
        });
    }

    private _deleteGroup(group: GroupRow): void {
        this.isLoading = true;
        this._userGroupService.delete(group.id).pipe(
            finalize(() => {
                this.isLoading = false;
                this._changeDetectorRef.markForCheck();
            })
        ).subscribe({
            next: () => {
                this.groups = this.groups.filter(g => g.id !== group.id);
                this.selectedGroups = this.selectedGroups.filter(g => g.id !== group.id);
                this._toastService.open({
                    message: this._translocoService.translate('delete-success')
                });
            }
        });
    }

    // ==================== 多選刪除功能（參考 bim-data-import）====================

    /**
     * 檢查是否所有可刪除的群組都已被選中
     */
    isAllDeletableGroupsSelected(): boolean {
        const deletableGroups = this.groups.filter(g => !g.isNew);
        return deletableGroups.length > 0 &&
               this.selectedGroups.length === deletableGroups.length;
    }

    /**
     * 切換全選狀態
     */
    toggleSelectAll(): void {
        const deletableGroups = this.groups.filter(g => !g.isNew);

        if (this.isAllDeletableGroupsSelected()) {
            this.selectedGroups = [];
        } else {
            this.selectedGroups = [...deletableGroups];
        }
        this._changeDetectorRef.markForCheck();
    }

    /**
     * 切換行選擇狀態
     */
    toggleRowSelection(group: GroupRow, event: Event): void {
        // 新增中的群組不可選
        if (group.isNew) {
            return;
        }

        // 檢查是否點擊了按鈕、checkbox、input 或其子元素
        const target = event.target as HTMLElement;
        if (target.closest('button') ||
            target.closest('mat-icon') ||
            target.closest('input') ||
            target.closest('p-tablecheckbox') ||
            target.closest('p-checkbox') ||
            target.closest('.p-checkbox')) {
            return;
        }

        // 切換選擇狀態
        const index = this.selectedGroups.findIndex(g => g.id === group.id);
        if (index > -1) {
            this.selectedGroups = this.selectedGroups.filter(g => g.id !== group.id);
        } else {
            this.selectedGroups = [...this.selectedGroups, group];
        }
        this._changeDetectorRef.markForCheck();
    }

    /**
     * 批量刪除
     */
    onBatchDelete(): void {
        if (this.selectedGroups.length === 0) {
            this._toastService.open({
                message: this._translocoService.translate('no-groups-selected')
            });
            return;
        }

        const dialogRef = this._gtsConfirmationService.open({
            title: this._translocoService.translate('confirm-action'),
            message: this._translocoService.translate('batch-delete-confirm', {
                count: this.selectedGroups.length
            }),
            icon: { color: 'warn' },
            actions: {
                confirm: { label: this._translocoService.translate('delete'), color: 'warn' },
                cancel: { label: this._translocoService.translate('cancel') }
            }
        });

        dialogRef.afterClosed().subscribe(res => {
            if (res === 'confirmed') {
                this._batchDelete();
            }
        });
    }

    private _batchDelete(): void {
        this.isLoading = true;
        this._changeDetectorRef.markForCheck();

        // 分離新增（尚未儲存）和已存在的群組
        const newGroups = this.selectedGroups.filter(g => g.isNew);
        const existingGroups = this.selectedGroups.filter(g => !g.isNew);

        // 直接從列表移除新增的群組
        newGroups.forEach(group => {
            this.groups = this.groups.filter(g => g !== group);
        });

        // 如果沒有需要調用 API 刪除的群組
        if (existingGroups.length === 0) {
            this.selectedGroups = [];
            this.isLoading = false;
            this._toastService.open({
                message: this._translocoService.translate('delete-success')
            });
            this._changeDetectorRef.markForCheck();
            return;
        }

        // 刪除已存在的群組（需要調用 API）
        let completedCount = 0;
        let errorCount = 0;

        existingGroups.forEach(group => {
            this._userGroupService.delete(group.id).subscribe({
                next: () => {
                    this.groups = this.groups.filter(g => g.id !== group.id);
                    completedCount++;

                    if (completedCount + errorCount === existingGroups.length) {
                        this._finalizeBatchDelete(completedCount, errorCount);
                    }
                },
                error: (err) => {
                    console.error(`Failed to delete group ${group.name}:`, err);
                    errorCount++;

                    if (completedCount + errorCount === existingGroups.length) {
                        this._finalizeBatchDelete(completedCount, errorCount);
                    }
                }
            });
        });
    }

    private _finalizeBatchDelete(successCount: number, errorCount: number): void {
        this.selectedGroups = [];
        this.isLoading = false;

        if (errorCount > 0) {
            this._toastService.open({
                message: this._translocoService.translate('batch-delete-partial', {
                    success: successCount,
                    error: errorCount
                })
            });
        } else {
            this._toastService.open({
                message: this._translocoService.translate('delete-success')
            });
        }

        this._changeDetectorRef.markForCheck();
    }

    // ==================== 工具函數 ====================

    trackByFn(index: number, item: GroupRow): any {
        return item.id || item.tempId || index;
    }

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
