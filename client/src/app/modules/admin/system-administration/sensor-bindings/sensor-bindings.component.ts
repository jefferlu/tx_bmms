import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewEncapsulation, ViewChild } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule, NgForm, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TranslocoModule } from '@jsverse/transloco';
import { TableModule } from 'primeng/table';
import { Subject, takeUntil, forkJoin, finalize } from 'rxjs';
import { SensorService, Sensor, SensorBimBinding } from 'app/core/services/sensors';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { GtsMediaWatcherService } from '@gts/services/media-watcher';
import { GtsConfirmationService } from '@gts/services/confirmation';

@Component({
    selector: 'app-sensor-bindings',
    standalone: true,
    imports: [
        CommonModule,
        NgTemplateOutlet,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatSidenavModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatDividerModule,
        MatCheckboxModule,
        TranslocoModule,
        TableModule
    ],
    templateUrl: './sensor-bindings.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    styles: [`
        :host {
            display: flex;
            flex-direction: column;
            flex: 1 1 auto;
            width: 100%;
        }
    `]
})
export class SensorBindingsComponent implements OnInit, OnDestroy {
    @ViewChild('matDrawer', { static: true }) matDrawer: MatDrawer;
    @ViewChild('ngForm') ngForm: NgForm;

    drawerMode: 'side' | 'over';
    form: UntypedFormGroup;

    page: any = {
        bindings: [],
        sensors: [],
        record: {}
    };

    bindings: SensorBimBinding[] = [];
    sensors: Sensor[] = [];
    isLoading: boolean = false;
    isSelectingFromViewer: boolean = false;

    // 位置類型選項
    positionTypeOptions = [
        { label: '中心', value: 'center' },
        { label: '頂部', value: 'top' },
        { label: '底部', value: 'bottom' },
        { label: '自訂', value: 'custom' }
    ];

    private _unsubscribeAll: Subject<void> = new Subject<void>();
    private _viewerSelectionHandler: any;

    constructor(
        private _sensorService: SensorService,
        private _toastService: ToastService,
        private _changeDetectorRef: ChangeDetectorRef,
        private _formBuilder: UntypedFormBuilder,
        private _gtsMediaWatcherService: GtsMediaWatcherService,
        private _gtsConfirmationService: GtsConfirmationService
    ) {}

    ngOnInit(): void {
        // 監聽螢幕尺寸變化
        this._gtsMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                if (matchingAliases.includes('lg')) {
                    this.drawerMode = 'side';
                } else {
                    this.drawerMode = 'over';
                }
                this._changeDetectorRef.markForCheck();
            });

        // 載入資料
        this.loadData();

        // 建立表單
        this.form = this._formBuilder.group({
            sensor: [null, Validators.required],
            model_urn: ['', Validators.required],
            element_dbid: [null, Validators.required],
            element_name: [''],
            element_external_id: [''],
            position_type: ['center'],
            position_offset: this._formBuilder.group({
                x: [0],
                y: [0],
                z: [0]
            }),
            label_visible: [true],
            icon_type: [''],
            color: [''],
            priority: [0],
            notes: [''],
            is_active: [true]
        });

        // 監聽來自 Viewer 的元件選擇事件
        this._viewerSelectionHandler = (event: any) => {
            if (this.isSelectingFromViewer && event.detail) {
                this.onViewerElementSelected(event.detail);
            }
        };
        window.addEventListener('viewer-element-selected', this._viewerSelectionHandler);
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();

        // 移除事件監聽器
        if (this._viewerSelectionHandler) {
            window.removeEventListener('viewer-element-selected', this._viewerSelectionHandler);
        }
    }

    /**
     * 使用 forkJoin 同時載入綁定和感測器資料
     */
    loadData(): void {
        this.isLoading = true;

        forkJoin({
            bindings: this._sensorService.getBindings(),
            sensors: this._sensorService.getSensors({ is_active: true })
        })
        .pipe(takeUntil(this._unsubscribeAll))
        .subscribe({
            next: (result) => {
                this.page.bindings = result.bindings;
                this.page.sensors = result.sensors;
                this.bindings = result.bindings;
                this.sensors = result.sensors;
                this.isLoading = false;
                this._changeDetectorRef.markForCheck();
            },
            error: (error) => {
                console.error('Failed to load data:', error);
                this._toastService.open({ message: '載入資料失敗' });
                this.isLoading = false;
                this._changeDetectorRef.markForCheck();
            }
        });
    }

    /**
     * 打開 Drawer (新增或編輯)
     */
    onOpenDrawer(event?: any): void {
        this.page.record = event?.data || {};

        // 編輯模式
        if (this.page.record.id) {
            this.form.patchValue(this.page.record);
        }
        // 新增模式
        else {
            this.ngForm?.resetForm();
            this.form.patchValue({
                position_type: 'center',
                label_visible: true,
                priority: 0,
                is_active: true,
                position_offset: { x: 0, y: 0, z: 0 }
            });
        }

        this.matDrawer.open();
        this._changeDetectorRef.markForCheck();
    }

    /**
     * 關閉 Drawer
     */
    onCloseDrawer(): void {
        this.matDrawer.close();
        this._changeDetectorRef.markForCheck();
    }

    /**
     * 儲存綁定
     */
    onSave(): void {
        if (this.form.invalid) {
            this._toastService.open({ message: '請填寫必填欄位' });
            return;
        }

        this.isLoading = true;
        this._changeDetectorRef.markForCheck();

        const formValue = this.form.value;

        // 編輯模式
        if (this.page.record.id) {
            const request = {
                id: this.page.record.id,
                ...formValue
            };

            this._sensorService.updateBinding(request.id, request)
                .pipe(
                    finalize(() => {
                        this.isLoading = false;
                        this._changeDetectorRef.markForCheck();
                    }),
                    takeUntil(this._unsubscribeAll)
                )
                .subscribe({
                    next: () => {
                        this._toastService.open({ message: '綁定已更新' });
                        this.onCloseDrawer();
                        this.loadData();
                    },
                    error: (error) => {
                        console.error('Failed to update binding:', error);
                        this._toastService.open({ message: '更新綁定失敗' });
                    }
                });
        }
        // 新增模式
        else {
            this._sensorService.createBinding(formValue)
                .pipe(
                    finalize(() => {
                        this.isLoading = false;
                        this._changeDetectorRef.markForCheck();
                    }),
                    takeUntil(this._unsubscribeAll)
                )
                .subscribe({
                    next: () => {
                        this._toastService.open({ message: '綁定已建立' });
                        this.ngForm?.resetForm();
                        this.loadData();
                    },
                    error: (error) => {
                        console.error('Failed to create binding:', error);
                        this._toastService.open({ message: '建立綁定失敗' });
                    }
                });
        }
    }

    /**
     * 刪除綁定
     */
    onDelete(): void {
        const dialogRef = this._gtsConfirmationService.open({
            title: '確認刪除',
            message: '確定要刪除此綁定嗎？',
            icon: { color: 'warn' },
            actions: {
                confirm: { label: '刪除', color: 'warn' },
                cancel: { label: '取消' }
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result === 'confirmed') {
                this.delete();
            }
        });
    }

    /**
     * 執行刪除
     */
    delete(): void {
        this.isLoading = true;
        this._changeDetectorRef.markForCheck();

        this._sensorService.deleteBinding(this.page.record.id)
            .pipe(
                finalize(() => {
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                    this.onCloseDrawer();
                }),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe({
                next: () => {
                    this._toastService.open({ message: '綁定已刪除' });
                    this.loadData();
                },
                error: (error) => {
                    console.error('Failed to delete binding:', error);
                    this._toastService.open({ message: '刪除綁定失敗' });
                }
            });
    }

    /**
     * 取得感測器名稱
     */
    getSensorName(sensorId: number): string {
        const sensor = this.sensors.find(s => s.id === sensorId);
        return sensor ? sensor.name : `Sensor #${sensorId}`;
    }

    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    /**
     * 從 Viewer 選擇元件
     */
    onSelectFromViewer(): void {
        this.isSelectingFromViewer = true;
        this._changeDetectorRef.markForCheck();

        // 發送事件通知 Viewer 進入選擇模式
        window.dispatchEvent(new CustomEvent('sensor-binding-select-mode', {
            detail: { active: true }
        }));

        this._toastService.open({ message: '請在 3D 模型中選擇元件...' });
    }

    /**
     * 處理從 Viewer 選擇的元件
     */
    onViewerElementSelected(elementInfo: { dbId: number; name: string; urn: string }): void {
        // 填充表單
        this.form.patchValue({
            model_urn: elementInfo.urn,
            element_dbid: elementInfo.dbId,
            element_name: elementInfo.name
        });

        // 取消選擇模式
        this.isSelectingFromViewer = false;
        this._changeDetectorRef.markForCheck();

        // 通知 Viewer 退出選擇模式
        window.dispatchEvent(new CustomEvent('sensor-binding-select-mode', {
            detail: { active: false }
        }));

        this._toastService.open({
            message: `已選擇元件: ${elementInfo.name} (DBID: ${elementInfo.dbId})`
        });
    }
}
