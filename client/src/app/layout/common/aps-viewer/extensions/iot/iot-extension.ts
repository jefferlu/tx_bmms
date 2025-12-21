import { Injector } from '@angular/core';
import { Observable, Subject, of, throwError } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { SensorService, Sensor, SensorBimBinding, PositionType } from 'app/core/services/sensors';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { GtsConfirmationService } from '@gts/services/confirmation';
import { SensorMarker } from './sensor-marker';

declare const Autodesk: any;
declare const THREE: any;
declare const echarts: any;

/**
 * IoT Extension for Autodesk Forge Viewer
 * 提供感測器綁定功能
 */
export class IotExtension extends Autodesk.Viewing.Extension {
    private injector: Injector;
    private sensorService: SensorService;
    private toastService: ToastService;
    private confirmationService: GtsConfirmationService;

    private markers: Map<string, SensorMarker> = new Map();
    private bindings: Map<string, SensorBimBinding[]> = new Map();

    private isInitialized: boolean = false;
    private currentModelUrn: string | null = null;
    private selectedElementDbId: number | null = null;
    private selectedElementInfo: {
        dbId: number;
        name: string;
        urn: string;
    } | null = null;

    // 綁定對話框元素
    private bindingDialog: HTMLDivElement | null = null;
    private sensors: Sensor[] = [];

    // 數據圖表對話框
    private dataDialog: HTMLDivElement | null = null;
    private chartInstance: any = null;
    private dataUpdateInterval: any = null;

    // RxJS 訂閱管理
    private _unsubscribeAll: Subject<void> = new Subject<void>();

    constructor(viewer: any, options: any) {
        super(viewer, options);

        // 從 options 獲取 Angular Injector
        this.injector = options.injector;
        if (!this.injector) {
            console.error('IoT Extension requires Angular Injector in options');
            return;
        }

        try {
            this.sensorService = this.injector.get(SensorService);
            this.toastService = this.injector.get(ToastService);
            this.confirmationService = this.injector.get(GtsConfirmationService);

            if (!this.sensorService) {
                console.error('Failed to get SensorService from Injector');
            }
            if (!this.toastService) {
                console.error('Failed to get ToastService from Injector');
            }
            if (!this.confirmationService) {
                console.error('Failed to get GtsConfirmationService from Injector');
            }
        } catch (error) {
            console.error('Failed to inject services:', error);
        }
    }

    /**
     * Extension 載入時調用
     */
    public load(): boolean {
        console.log('IoT Extension loading...');

        // 創建工具欄按鈕
        this.createToolbarButton();

        // 監聽元件選擇事件
        this.viewer.addEventListener(
            Autodesk.Viewing.SELECTION_CHANGED_EVENT,
            this.onSelectionChanged.bind(this)
        );

        // 監聽模型載入完成事件
        this.viewer.addEventListener(
            Autodesk.Viewing.GEOMETRY_LOADED_EVENT,
            () => {
                console.log('Model geometry loaded');
                // 設置當前模型 URN
                if (this.viewer.model) {
                    try {
                        const modelData = this.viewer.model.getData();
                        this.currentModelUrn = modelData ? modelData.urn : null;
                        console.log('Current model URN:', this.currentModelUrn);
                    } catch (e) {
                        console.error('Failed to get model URN:', e);
                    }
                }
                // 載入當前模型的綁定
                this.loadSensorsForCurrentModel();
            }
        );

        // 載入感測器列表
        this.loadSensors();

        // 如果模型已經載入，立即載入綁定
        if (this.viewer.model) {
            try {
                const modelData = this.viewer.model.getData();
                this.currentModelUrn = modelData ? modelData.urn : null;
                console.log('Current model URN (immediate):', this.currentModelUrn);
                if (this.currentModelUrn) {
                    this.loadSensorsForCurrentModel();
                }
            } catch (e) {
                console.error('Failed to get model URN on load:', e);
            }
        }

        console.log('IoT Extension loaded');
        return true;
    }

    /**
     * Extension 卸載時調用
     */
    public unload(): boolean {
        console.log('IoT Extension unloading...');

        // 取消所有訂閱
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();

        // 清理標記
        this.clearAllMarkers();

        // 移除綁定對話框
        if (this.bindingDialog) {
            this.bindingDialog.remove();
            this.bindingDialog = null;
        }

        // 移除數據對話框和清理資源
        this.closeDataDialog();

        console.log('IoT Extension unloaded');
        return true;
    }

    /**
     * 創建工具欄按鈕
     */
    private createToolbarButton(): void {
        const toolbar = this.viewer.toolbar;
        if (!toolbar) {
            console.warn('Toolbar not found');
            return;
        }

        // 創建按鈕組
        const iotGroup = new Autodesk.Viewing.UI.ControlGroup('iot-toolbar-group');

        // 創建綁定按鈕
        const bindButton = new Autodesk.Viewing.UI.Button('iot-bind-button');
        const bindingImg = document.createElement('img');
        bindingImg.src = 'assets/aps/svg/binding.svg';
        bindingImg.style.width = '24px';
        bindingImg.style.height = '24px';
        bindButton.container.appendChild(bindingImg);
        bindButton.addClass('bmms-button');

        bindButton.setToolTip('綁定感測器');
        bindButton.setIcon('adsk-icon-iot');
        bindButton.onClick = () => this.showBindingDialog();

        // 創建查看數據按鈕
        const dataButton = new Autodesk.Viewing.UI.Button('iot-data-button');
        dataButton.setToolTip('查看感測器數據');
        dataButton.setIcon('adsk-icon-chart');
        dataButton.onClick = () => this.showDataDialog();

        iotGroup.addControl(bindButton);
        iotGroup.addControl(dataButton);
        toolbar.addControl(iotGroup);
    }

    /**
     * 處理元件選擇變化
     */
    private onSelectionChanged(event: any): void {
        const selection = this.viewer.getSelection();
        if (selection && selection.length > 0) {
            const dbId = selection[0];
            this.selectedElementDbId = dbId;

            // 獲取元件詳細資訊
            this.getElementInfo(dbId)
                .pipe(
                    takeUntil(this._unsubscribeAll),
                    catchError(err => {
                        console.error('Failed to get element info:', err);
                        this.selectedElementInfo = null;
                        return of(null);
                    })
                )
                .subscribe(info => {
                    if (info) {
                        this.selectedElementInfo = info;
                        console.log('Element info updated:', info);
                    }
                });
        } else {
            this.selectedElementDbId = null;
            this.selectedElementInfo = null;
        }
    }

    /**
     * 顯示綁定對話框
     */
    private showBindingDialog(): void {
        if (!this.selectedElementInfo) {
            this.toastService.open({
                type: 'info',
                message: '請先選擇一個 BIM 元件',
                duration: 3
            });
            return;
        }

        // 如果對話框已存在，先移除
        if (this.bindingDialog) {
            this.bindingDialog.remove();
        }

        // 創建對話框
        this.createBindingDialog();
    }

    /**
     * 創建綁定對話框 (Dark Mode)
     */
    private createBindingDialog(): void {
        // 創建遮罩層
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 9999;
        `;

        // 創建對話框容器
        const dialog = document.createElement('div');
        dialog.className = 'iot-binding-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1e1e1e;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            border: 1px solid #3a3a3a;
            z-index: 10000;
            min-width: 400px;
            max-width: 500px;
        `;

        // 共用的關閉函數
        const closeDialog = () => {
            dialog.remove();
            overlay.remove();
            this.bindingDialog = null;
        };

        // 標題
        const title = document.createElement('h3');
        title.textContent = '綁定感測器到元件';
        title.style.cssText = 'margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #e0e0e0;';
        dialog.appendChild(title);

        // 元件資訊區域
        const infoSection = document.createElement('div');
        infoSection.style.cssText = 'background: #2a2a2a; padding: 12px; border-radius: 4px; margin-bottom: 20px; border: 1px solid #3a3a3a;';
        infoSection.innerHTML = `
            <div style="font-size: 12px; color: #999; margin-bottom: 8px; font-weight: 600;">選中的元件資訊</div>
            <div style="font-size: 13px; margin-bottom: 4px; color: #e0e0e0;"><strong style="color: #aaa;">名稱：</strong>${this.selectedElementInfo!.name}</div>
            <div style="font-size: 13px; margin-bottom: 4px; color: #e0e0e0;"><strong style="color: #aaa;">DBID：</strong>${this.selectedElementInfo!.dbId}</div>
            <div style="font-size: 11px; word-break: break-all; color: #bbb;"><strong style="color: #aaa;">URN：</strong>${this.selectedElementInfo!.urn}</div>
        `;
        dialog.appendChild(infoSection);

        // 感測器選擇區域
        const sensorLabel = document.createElement('label');
        sensorLabel.textContent = '選擇感測器：';
        sensorLabel.style.cssText = 'display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; color: #e0e0e0;';
        dialog.appendChild(sensorLabel);

        const sensorSelect = document.createElement('select');
        sensorSelect.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #3a3a3a;
            border-radius: 4px;
            font-size: 14px;
            margin-bottom: 20px;
            background: #2a2a2a;
            color: #e0e0e0;
        `;

        // 添加空選項
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '-- 請選擇感測器 --';
        sensorSelect.appendChild(emptyOption);

        // 添加感測器選項
        this.sensors.forEach(sensor => {
            const option = document.createElement('option');
            option.value = sensor.id.toString();
            option.textContent = `${sensor.name} (${sensor.sensor_id})`;
            sensorSelect.appendChild(option);
        });
        dialog.appendChild(sensorSelect);

        // 按鈕區域
        const buttonGroup = document.createElement('div');
        buttonGroup.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end;';

        // 取消按鈕
        const cancelButton = document.createElement('button');
        cancelButton.textContent = '取消';
        cancelButton.style.cssText = `
            padding: 8px 20px;
            border: 1px solid #3a3a3a;
            background: #2a2a2a;
            color: #e0e0e0;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        `;
        cancelButton.onmouseenter = () => cancelButton.style.background = '#333';
        cancelButton.onmouseleave = () => cancelButton.style.background = '#2a2a2a';
        cancelButton.onclick = () => {
            closeDialog();
        };
        buttonGroup.appendChild(cancelButton);

        // 綁定按鈕
        const bindButton = document.createElement('button');
        bindButton.textContent = '綁定';
        bindButton.style.cssText = `
            padding: 8px 20px;
            border: none;
            background: #2196F3;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background 0.2s;
        `;
        bindButton.onmouseenter = () => bindButton.style.background = '#1976D2';
        bindButton.onmouseleave = () => bindButton.style.background = '#2196F3';
        bindButton.onclick = () => {
            const sensorId = sensorSelect.value;
            if (!sensorId) {
                this.toastService.open({
                    type: 'info',
                    message: '請選擇感測器',
                    duration: 3
                });
                return;
            }
            this.createBinding(parseInt(sensorId));
            closeDialog();
        };
        buttonGroup.appendChild(bindButton);

        dialog.appendChild(buttonGroup);

        // 點擊遮罩層關閉
        overlay.onclick = () => {
            closeDialog();
        };

        document.body.appendChild(overlay);
        document.body.appendChild(dialog);

        this.bindingDialog = dialog;
    }

    /**
     * 創建綁定
     */
    private createBinding(sensorId: number): void {
        if (!this.selectedElementInfo) {
            return;
        }

        // 檢查該 sensor 是否已有綁定
        this.sensorService.getBindings().subscribe({
            next: (bindings) => {
                const existingBinding = bindings.find(b => b.sensor === sensorId);

                if (existingBinding) {
                    // 感測器已綁定到其他元件，詢問是否要改綁
                    const oldElementName = existingBinding.element_name || 'DBID: ' + existingBinding.element_dbid;
                    const newElementName = this.selectedElementInfo!.name;

                    this.confirmationService.open({
                        title: '確認重新綁定',
                        message: `此感測器已綁定至元件「${oldElementName}」\n\n確定要改為綁定至「${newElementName}」嗎？\n\n（原有的綁定將會被移除）`,
                        icon: {
                            show: true,
                            name: 'heroicons_outline:exclamation-triangle',
                            color: 'warn'
                        },
                        actions: {
                            confirm: {
                                show: true,
                                label: '確認重新綁定',
                                color: 'warn'
                            },
                            cancel: {
                                show: true,
                                label: '取消'
                            }
                        },
                        dismissible: true
                    }).afterClosed().subscribe((result) => {
                        if (result === 'confirmed') {
                            // 先刪除舊綁定，再創建新綁定
                            this.sensorService.deleteBinding(existingBinding.id).subscribe({
                                next: () => {
                                    console.log('舊綁定已刪除，創建新綁定...');
                                    this.performBinding(sensorId);
                                },
                                error: (err) => {
                                    console.error('刪除舊綁定失敗:', err);
                                    this.toastService.open({
                                        type: 'error',
                                        message: '刪除舊綁定失敗：' + (err.error?.message || '未知錯誤'),
                                        duration: 5
                                    });
                                }
                            });
                        }
                    });
                } else {
                    // 感測器未綁定，直接創建新綁定
                    this.performBinding(sensorId);
                }
            },
            error: (err) => {
                console.error('檢查綁定狀態失敗:', err);
                this.toastService.open({
                    type: 'error',
                    message: '檢查綁定狀態失敗：' + (err.error?.message || '未知錯誤'),
                    duration: 5
                });
            }
        });
    }

    /**
     * 執行綁定操作
     */
    private performBinding(sensorId: number): void {
        if (!this.selectedElementInfo) {
            return;
        }

        const binding = {
            sensor: sensorId,
            model_urn: this.selectedElementInfo.urn,
            element_dbid: this.selectedElementInfo.dbId,
            element_name: this.selectedElementInfo.name,
            position_type: 'center' as PositionType,
            label_visible: true,
            priority: 0,
            is_active: true,
            position_offset: { x: 0, y: 0, z: 0 }
        };

        this.sensorService.createBinding(binding).subscribe({
            next: () => {
                this.toastService.open({
                    type: 'info',
                    message: '綁定成功！',
                    duration: 3
                });
                // 重新載入綁定資料
                this.loadSensorsForCurrentModel();
            },
            error: (err) => {
                console.error('綁定失敗:', err);
                this.toastService.open({
                    type: 'error',
                    message: '綁定失敗：' + (err.error?.message || '未知錯誤'),
                    duration: 5
                });
            }
        });
    }

    /**
     * 載入感測器列表
     */
    private loadSensors(): void {
        this.sensorService.getSensors({ is_active: true }).subscribe({
            next: (sensors) => {
                this.sensors = sensors;
            },
            error: (err) => {
                console.error('載入感測器失敗:', err);
            }
        });
    }

    /**
     * 載入當前模型的感測器
     */
    public loadSensorsForCurrentModel(modelUrn?: string): void {
        // 獲取當前載入的模型 URN
        if (!modelUrn && this.viewer.model) {
            this.currentModelUrn = this.viewer.model.getData().urn;
        } else if (modelUrn) {
            this.currentModelUrn = modelUrn;
        }

        if (!this.currentModelUrn) {
            console.warn('No model loaded');
            return;
        }

        // 獲取該模型的所有感測器綁定
        this.sensorService.getBindingsByModel(this.currentModelUrn).subscribe({
            next: (bindings) => {
                this.processBindings(bindings);
            },
            error: (err) => {
                console.error('Failed to load sensor bindings:', err);
            }
        });
    }

    /**
     * 處理感測器綁定數據
     */
    private processBindings(bindings: SensorBimBinding[]): void {
        // 清除現有標記
        this.clearAllMarkers();

        // 按感測器分組綁定
        bindings.forEach(binding => {
            const sensorId = binding.sensor.toString();
            if (!this.bindings.has(sensorId)) {
                this.bindings.set(sensorId, []);
            }
            this.bindings.get(sensorId)!.push(binding);
        });

        // 為每個綁定創建標記
        bindings.forEach(binding => {
            this.createMarkerForBinding(binding);
        });

        console.log(`Loaded ${bindings.length} sensor bindings`);
    }

    /**
     * 取得指定元件的感測器綁定
     */
    public getBindingsForElement(elementDbId: number, modelUrn: string): SensorBimBinding[] {
        const elementBindings: SensorBimBinding[] = [];

        this.bindings.forEach((bindingList, sensorId) => {
            bindingList.forEach(binding => {
                if (binding.element_dbid === elementDbId && binding.model_urn === modelUrn) {
                    elementBindings.push(binding);
                }
            });
        });

        return elementBindings;
    }

    /**
     * 獲取當前選中元件的資訊
     */
    public getSelectedElementInfo(): {
        dbId: number;
        name: string;
        urn: string;
    } | null {
        return this.selectedElementInfo;
    }

    /**
     * 獲取元件詳細資訊
     */
    private getElementInfo(dbId: number): Observable<{
        dbId: number;
        name: string;
        urn: string;
    }> {
        return new Observable(observer => {
            try {
                // 檢查 viewer 和 model 是否存在
                if (!this.viewer || !this.viewer.model) {
                    console.error('Viewer or model not available');
                    observer.error(new Error('Viewer or model not available'));
                    return;
                }

                const model = this.viewer.model;
                const tree = model.getInstanceTree();

                if (!tree) {
                    console.error('Instance tree not available');
                    observer.error(new Error('Instance tree not available'));
                    return;
                }

                // 獲取 URN
                let urn = this.currentModelUrn;
                if (!urn) {
                    try {
                        const modelData = model.getData();
                        urn = modelData ? modelData.urn : null;
                    } catch (e) {
                        console.error('Failed to get model URN:', e);
                    }
                }

                if (!urn) {
                    console.error('Model URN not available');
                    observer.error(new Error('Model URN not available'));
                    return;
                }

                // 獲取元件名稱 - 這是同步方法，直接返回字符串
                const name = tree.getNodeName(dbId);

                observer.next({
                    dbId,
                    name: name || `Element ${dbId}`,
                    urn
                });
                observer.complete();
            } catch (error) {
                console.error('Error in getElementInfo:', error);
                observer.error(error);
            }
        });
    }

    /**
     * 為綁定創建標記
     */
    private createMarkerForBinding(binding: SensorBimBinding): void {
        // 獲取 BIM 元件的中心位置
        const position = this.getElementPosition(binding.element_dbid);
        if (!position) {
            console.warn(`Cannot get position for dbId ${binding.element_dbid}`);
            return;
        }

        // 應用位置偏移（如果有）
        if (binding.position_offset) {
            position.x += binding.position_offset.x || 0;
            position.y += binding.position_offset.y || 0;
            position.z += binding.position_offset.z || 0;
        }

        // 創建標記
        const sensorId = binding.sensor.toString();
        if (!this.markers.has(sensorId)) {
            const marker = new SensorMarker(
                this.viewer,
                sensorId,
                binding.element_dbid,
                binding.model_urn,
                position
            );
            this.markers.set(sensorId, marker);
        }
    }

    /**
     * 獲取 BIM 元件的中心位置
     */
    private getElementPosition(dbId: number): any {
        const fragList = this.viewer.model.getFragmentList();
        const tree = this.viewer.model.getInstanceTree();

        if (!tree || !fragList) {
            return null;
        }

        let bounds = new THREE.Box3();
        tree.enumNodeFragments(dbId, (fragId: number) => {
            const box = new THREE.Box3();
            fragList.getWorldBounds(fragId, box);
            bounds.union(box);
        }, true);

        if (bounds.isEmpty()) {
            return null;
        }

        return bounds.getCenter(new THREE.Vector3());
    }

    /**
     * 聚焦到指定感測器
     */
    public focusOnSensor(sensorId: string): void {
        const marker = this.markers.get(sensorId);
        if (!marker) {
            console.warn(`Marker not found for sensor ${sensorId}`);
            return;
        }

        // 聚焦到該元件
        const dbId = marker.getDbId();
        this.viewer.fitToView([dbId]);

        // 高亮標記
        this.highlightMarker(sensorId, true);

        // 2 秒後取消高亮
        setTimeout(() => {
            this.highlightMarker(sensorId, false);
        }, 2000);
    }

    /**
     * 高亮標記
     */
    private highlightMarker(sensorId: string, enabled: boolean): void {
        const marker = this.markers.get(sensorId);
        if (marker) {
            marker.highlight(enabled);
        }
    }

    /**
     * 設置標記可見性
     */
    public setMarkersVisible(visible: boolean): void {
        this.markers.forEach(marker => {
            marker.setVisible(visible);
        });
    }

    /**
     * 清除所有標記
     */
    private clearAllMarkers(): void {
        this.markers.forEach(marker => {
            marker.dispose();
        });
        this.markers.clear();
        this.bindings.clear();
    }

    /**
     * 顯示數據圖表對話框
     */
    private showDataDialog(): void {
        if (!this.selectedElementInfo) {
            this.toastService.open({
                type: 'warning',
                message: '請先選擇一個 BIM 元件',
                duration: 3
            });
            return;
        }

        // 獲取選中元件的綁定
        this.sensorService.getBindings().subscribe({
            next: (bindings) => {
                const elementBinding = bindings.find(
                    b => b.element_dbid === this.selectedElementInfo!.dbId &&
                         b.model_urn === this.selectedElementInfo!.urn &&
                         b.is_active
                );

                if (!elementBinding) {
                    this.toastService.open({
                        type: 'warning',
                        message: '此元件尚未綁定感測器',
                        duration: 3
                    });
                    return;
                }

                // 顯示圖表
                this.createDataDialog(elementBinding);
            },
            error: (err) => {
                console.error('獲取綁定失敗:', err);
                this.toastService.open({
                    type: 'error',
                    message: '獲取綁定資料失敗',
                    duration: 3
                });
            }
        });
    }

    /**
     * 創建數據圖表對話框
     */
    private createDataDialog(binding: SensorBimBinding): void {
        // 如果對話框已存在，先關閉
        if (this.dataDialog) {
            this.closeDataDialog();
        }

        // 載入 ECharts (如果尚未載入)
        this.loadECharts().then(() => {
            this.buildDataDialog(binding);
        }).catch(err => {
            console.error('載入 ECharts 失敗:', err);
            this.toastService.open({
                type: 'error',
                message: '載入圖表庫失敗',
                duration: 3
            });
        });
    }

    /**
     * 載入 ECharts 庫
     */
    private loadECharts(): Promise<void> {
        return new Promise((resolve, reject) => {
            // 檢查是否已載入
            if (typeof echarts !== 'undefined') {
                resolve();
                return;
            }

            // 動態載入 ECharts
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load ECharts'));
            document.head.appendChild(script);
        });
    }

    /**
     * 建立數據圖表對話框
     */
    private buildDataDialog(binding: SensorBimBinding): void {
        // 創建遮罩層
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 9999;
        `;

        // 創建對話框
        const dialog = document.createElement('div');
        dialog.className = 'iot-data-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1e1e1e;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            border: 1px solid #3a3a3a;
            z-index: 10000;
            width: 800px;
            max-width: 90vw;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
        `;

        // 關閉函數
        const closeDialog = () => {
            this.closeDataDialog();
            overlay.remove();
        };

        // 標題列
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;';

        const title = document.createElement('h3');
        title.textContent = `感測器數據 - ${binding.element_name || 'Element ' + binding.element_dbid}`;
        title.style.cssText = 'margin: 0; font-size: 18px; font-weight: 600; color: #e0e0e0;';

        const closeButton = document.createElement('button');
        closeButton.textContent = '✕';
        closeButton.style.cssText = `
            background: none;
            border: none;
            color: #999;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: background 0.2s;
        `;
        closeButton.onmouseenter = () => closeButton.style.background = '#333';
        closeButton.onmouseleave = () => closeButton.style.background = 'none';
        closeButton.onclick = closeDialog;

        header.appendChild(title);
        header.appendChild(closeButton);
        dialog.appendChild(header);

        // 圖表容器
        const chartContainer = document.createElement('div');
        chartContainer.id = 'iot-chart-container';
        chartContainer.style.cssText = 'width: 100%; height: 500px; background: #2a2a2a; border-radius: 4px;';
        dialog.appendChild(chartContainer);

        // 點擊遮罩層關閉
        overlay.onclick = closeDialog;

        // 添加到頁面
        document.body.appendChild(overlay);
        document.body.appendChild(dialog);

        this.dataDialog = dialog;

        // 初始化圖表
        this.initChart(chartContainer, binding.sensor);
    }

    /**
     * 初始化 ECharts 圖表
     */
    private initChart(container: HTMLElement, sensorId: number): void {
        // 創建圖表實例 (不使用 dark theme，自定義配置)
        this.chartInstance = echarts.init(container);

        // 生成初始假數據（最近 100 個數據點，值為 0）
        const initialData: any[] = [];
        const now = new Date();
        for (let i = 99; i >= 0; i--) {
            const time = new Date(now.getTime() - i * 1000); // 每秒一個數據點
            initialData.push({
                name: time.toString(),
                value: [time, 0]
            });
        }

        // 初始配置
        const option = {
            backgroundColor: 'transparent', // 透明背景
            title: {
                text: '感測器即時數據',
                textStyle: {
                    color: '#e0e0e0'
                }
            },
            tooltip: {
                trigger: 'axis',
                formatter: (params: any) => {
                    const param = params[0];
                    const date = new Date(param.value[0]);
                    const hours = date.getHours().toString().padStart(2, '0');
                    const minutes = date.getMinutes().toString().padStart(2, '0');
                    const seconds = date.getSeconds().toString().padStart(2, '0');
                    return `${hours}:${minutes}:${seconds}<br/>${param.seriesName}: ${param.value[1]}`;
                },
                axisPointer: {
                    animation: false
                },
                backgroundColor: 'rgba(50, 50, 50, 0.9)',
                borderColor: '#3a3a3a',
                textStyle: {
                    color: '#e0e0e0'
                }
            },
            xAxis: {
                type: 'time',
                splitLine: {
                    show: false
                },
                axisLabel: {
                    color: '#999',
                    formatter: (value: number) => {
                        const date = new Date(value);
                        const hours = date.getHours().toString().padStart(2, '0');
                        const minutes = date.getMinutes().toString().padStart(2, '0');
                        const seconds = date.getSeconds().toString().padStart(2, '0');
                        return `${hours}:${minutes}:${seconds}`;
                    }
                },
                axisLine: {
                    lineStyle: {
                        color: '#3a3a3a'
                    }
                }
            },
            yAxis: {
                type: 'value',
                boundaryGap: [0, '100%'],
                splitLine: {
                    show: true,
                    lineStyle: {
                        color: '#3a3a3a'
                    }
                },
                axisLabel: {
                    color: '#999'
                },
                axisLine: {
                    show: true,
                    lineStyle: {
                        color: '#3a3a3a'
                    }
                }
            },
            series: [
                {
                    name: '數值',
                    type: 'line',
                    showSymbol: false,
                    data: initialData,
                    smooth: true,
                    lineStyle: {
                        color: '#2196F3',
                        width: 2
                    },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 0,
                            y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(33, 150, 243, 0.3)' },
                                { offset: 1, color: 'rgba(33, 150, 243, 0)' }
                            ]
                        }
                    }
                }
            ],
            grid: {
                left: '60px',
                right: '20px',
                bottom: '40px',
                top: '80px'
            }
        };

        this.chartInstance.setOption(option);

        // 嘗試載入歷史數據（如果有的話會替換假數據）
        this.loadHistoryData(sensorId);

        // 開始定時更新（每秒更新一次，即使沒有數據也更新時間軸）
        this.startDataUpdate(sensorId);
    }

    /**
     * 載入歷史數據
     */
    private loadHistoryData(sensorId: number): void {
        this.sensorService.getSensorHistory(sensorId, 1).subscribe({
            next: (logs) => {
                if (logs && logs.length > 0) {
                    // 有歷史數據，使用實際數據
                    const data = logs.map(log => ({
                        name: log.timestamp,
                        value: [new Date(log.timestamp), log.value]
                    }));

                    if (this.chartInstance) {
                        this.chartInstance.setOption({
                            series: [{
                                data: data
                            }]
                        });
                    }
                }
                // 如果沒有歷史數據，保持初始假數據（值為 0）
            },
            error: (err) => {
                console.error('載入歷史數據失敗:', err);
                // 錯誤時保持初始假數據（值為 0）
            }
        });
    }

    /**
     * 開始定時更新數據
     */
    private startDataUpdate(sensorId: number): void {
        // 清除舊的 interval
        if (this.dataUpdateInterval) {
            clearInterval(this.dataUpdateInterval);
        }

        // 每 1 秒更新一次
        this.dataUpdateInterval = setInterval(() => {
            const currentTime = new Date();

            this.sensorService.getSensorLatestData(sensorId).subscribe({
                next: (data) => {
                    if (this.chartInstance) {
                        const option = this.chartInstance.getOption();
                        const seriesData = option.series[0].data || [];

                        // 添加新數據（使用實際數據）
                        seriesData.push({
                            name: data.timestamp,
                            value: [new Date(data.timestamp), data.value]
                        });

                        // 保持最多 100 個數據點
                        if (seriesData.length > 100) {
                            seriesData.shift();
                        }

                        this.chartInstance.setOption({
                            series: [{
                                data: seriesData
                            }]
                        });
                    }
                },
                error: (err) => {
                    // 即使 API 錯誤或沒有數據，也要更新時間軸（值為 0）
                    if (this.chartInstance) {
                        const option = this.chartInstance.getOption();
                        const seriesData = option.series[0].data || [];

                        // 添加值為 0 的數據點
                        seriesData.push({
                            name: currentTime.toString(),
                            value: [currentTime, 0]
                        });

                        // 保持最多 100 個數據點
                        if (seriesData.length > 100) {
                            seriesData.shift();
                        }

                        this.chartInstance.setOption({
                            series: [{
                                data: seriesData
                            }]
                        });
                    }
                }
            });
        }, 1000); // 每秒更新
    }

    /**
     * 關閉數據對話框
     */
    private closeDataDialog(): void {
        // 停止更新
        if (this.dataUpdateInterval) {
            clearInterval(this.dataUpdateInterval);
            this.dataUpdateInterval = null;
        }

        // 銷毀圖表
        if (this.chartInstance) {
            this.chartInstance.dispose();
            this.chartInstance = null;
        }

        // 移除對話框
        if (this.dataDialog) {
            this.dataDialog.remove();
            this.dataDialog = null;
        }
    }

    /**
     * 動畫更新（可選）
     */
    public update(deltaTime: number): void {
        // 更新所有標記的動畫
        this.markers.forEach(marker => {
            marker.animate(deltaTime);
        });
    }
}

// 註冊 Extension
Autodesk.Viewing.theExtensionManager.registerExtension('IotExtension', IotExtension);
