import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoModule } from '@jsverse/transloco';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { SensorService, Sensor, SensorBimBinding } from 'app/core/services/sensors';

@Component({
    selector: 'app-sensor-bindings',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        TranslocoModule,
        TableModule,
        DialogModule,
        InputTextModule,
        DropdownModule,
        ButtonModule,
        ToastModule,
        ConfirmDialogModule,
        FormsModule
    ],
    providers: [MessageService, ConfirmationService],
    templateUrl: './sensor-bindings.component.html',
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
    bindings: SensorBimBinding[] = [];
    sensors: Sensor[] = [];
    isLoading: boolean = false;
    displayDialog: boolean = false;
    isEditMode: boolean = false;

    // 當前編輯的綁定
    currentBinding: Partial<SensorBimBinding> = {};

    // 位置類型選項
    positionTypeOptions = [
        { label: '中心', value: 'center' },
        { label: '頂部', value: 'top' },
        { label: '底部', value: 'bottom' },
        { label: '自訂', value: 'custom' }
    ];

    private _unsubscribeAll: Subject<void> = new Subject<void>();

    constructor(
        private _sensorService: SensorService,
        private _messageService: MessageService,
        private _confirmationService: ConfirmationService
    ) {}

    ngOnInit(): void {
        this.loadBindings();
        this.loadSensors();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    /**
     * 載入所有綁定
     */
    loadBindings(): void {
        this.isLoading = true;
        this._sensorService.getBindings()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (bindings) => {
                    this.bindings = bindings;
                    this.isLoading = false;
                },
                error: (error) => {
                    console.error('Failed to load bindings:', error);
                    this._messageService.add({
                        severity: 'error',
                        summary: '錯誤',
                        detail: '載入綁定失敗'
                    });
                    this.isLoading = false;
                }
            });
    }

    /**
     * 載入所有感測器
     */
    loadSensors(): void {
        this._sensorService.getSensors({ is_active: true })
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (sensors) => {
                    this.sensors = sensors;
                },
                error: (error) => {
                    console.error('Failed to load sensors:', error);
                }
            });
    }

    /**
     * 打開新增對話框
     */
    openNewDialog(): void {
        this.isEditMode = false;
        this.currentBinding = {
            position_type: 'center',
            label_visible: true,
            priority: 0,
            is_active: true
        };
        this.displayDialog = true;
    }

    /**
     * 打開編輯對話框
     */
    openEditDialog(binding: SensorBimBinding): void {
        this.isEditMode = true;
        this.currentBinding = { ...binding };
        this.displayDialog = true;
    }

    /**
     * 儲存綁定
     */
    saveBinding(): void {
        if (!this.validateBinding()) {
            return;
        }

        this.isLoading = true;

        const operation = this.isEditMode
            ? this._sensorService.updateBinding(this.currentBinding.id!, this.currentBinding)
            : this._sensorService.createBinding(this.currentBinding);

        operation.pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: () => {
                    this._messageService.add({
                        severity: 'success',
                        summary: '成功',
                        detail: this.isEditMode ? '綁定已更新' : '綁定已建立'
                    });
                    this.displayDialog = false;
                    this.loadBindings();
                },
                error: (error) => {
                    console.error('Failed to save binding:', error);
                    this._messageService.add({
                        severity: 'error',
                        summary: '錯誤',
                        detail: '儲存綁定失敗'
                    });
                    this.isLoading = false;
                }
            });
    }

    /**
     * 驗證綁定資料
     */
    validateBinding(): boolean {
        if (!this.currentBinding.sensor) {
            this._messageService.add({
                severity: 'warn',
                summary: '警告',
                detail: '請選擇感測器'
            });
            return false;
        }

        if (!this.currentBinding.model_urn) {
            this._messageService.add({
                severity: 'warn',
                summary: '警告',
                detail: '請輸入模型 URN'
            });
            return false;
        }

        if (!this.currentBinding.element_dbid) {
            this._messageService.add({
                severity: 'warn',
                summary: '警告',
                detail: '請輸入元件 DB ID'
            });
            return false;
        }

        return true;
    }

    /**
     * 刪除綁定
     */
    deleteBinding(binding: SensorBimBinding): void {
        this._confirmationService.confirm({
            message: `確定要刪除此綁定嗎？`,
            header: '確認刪除',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: '確定',
            rejectLabel: '取消',
            accept: () => {
                this.isLoading = true;
                this._sensorService.deleteBinding(binding.id)
                    .pipe(takeUntil(this._unsubscribeAll))
                    .subscribe({
                        next: () => {
                            this._messageService.add({
                                severity: 'success',
                                summary: '成功',
                                detail: '綁定已刪除'
                            });
                            this.loadBindings();
                        },
                        error: (error) => {
                            console.error('Failed to delete binding:', error);
                            this._messageService.add({
                                severity: 'error',
                                summary: '錯誤',
                                detail: '刪除綁定失敗'
                            });
                            this.isLoading = false;
                        }
                    });
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

    /**
     * 取消對話框
     */
    cancelDialog(): void {
        this.displayDialog = false;
        this.currentBinding = {};
    }
}
