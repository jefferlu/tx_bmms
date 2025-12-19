import { Injector } from '@angular/core';
import { SensorService, Sensor, SensorBimBinding, PositionType } from 'app/core/services/sensors';
import { SensorMarker } from './sensor-marker';

declare const Autodesk: any;
declare const THREE: any;

/**
 * IoT Extension for Autodesk Forge Viewer
 * 提供感測器綁定功能
 */
export class IotExtension extends Autodesk.Viewing.Extension {
    private injector: Injector;
    private sensorService: SensorService;

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

            if (!this.sensorService) {
                console.error('Failed to get SensorService from Injector');
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

        // 清理標記
        this.clearAllMarkers();

        // 移除對話框
        if (this.bindingDialog) {
            this.bindingDialog.remove();
            this.bindingDialog = null;
        }

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
        bindButton.setToolTip('綁定感測器');
        bindButton.setIcon('adsk-icon-iot');
        bindButton.onClick = () => this.showBindingDialog();

        iotGroup.addControl(bindButton);
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
            this.getElementInfo(dbId).then(info => {
                this.selectedElementInfo = info;
                console.log('Element info updated:', info);
            }).catch(err => {
                console.error('Failed to get element info:', err);
                this.selectedElementInfo = null;
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
            alert('請先選擇一個 BIM 元件');
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
     * 創建綁定對話框
     */
    private createBindingDialog(): void {
        // 創建對話框容器
        const dialog = document.createElement('div');
        dialog.className = 'iot-binding-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            min-width: 400px;
            max-width: 500px;
        `;

        // 標題
        const title = document.createElement('h3');
        title.textContent = '綁定感測器到元件';
        title.style.cssText = 'margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #333;';
        dialog.appendChild(title);

        // 元件資訊區域
        const infoSection = document.createElement('div');
        infoSection.style.cssText = 'background: #f5f5f5; padding: 12px; border-radius: 4px; margin-bottom: 20px;';
        infoSection.innerHTML = `
            <div style="font-size: 12px; color: #666; margin-bottom: 8px; font-weight: 600;">選中的元件資訊</div>
            <div style="font-size: 13px; margin-bottom: 4px;"><strong>名稱：</strong>${this.selectedElementInfo!.name}</div>
            <div style="font-size: 13px; margin-bottom: 4px;"><strong>DBID：</strong>${this.selectedElementInfo!.dbId}</div>
            <div style="font-size: 11px; word-break: break-all;"><strong>URN：</strong>${this.selectedElementInfo!.urn}</div>
        `;
        dialog.appendChild(infoSection);

        // 感測器選擇區域
        const sensorLabel = document.createElement('label');
        sensorLabel.textContent = '選擇感測器：';
        sensorLabel.style.cssText = 'display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; color: #333;';
        dialog.appendChild(sensorLabel);

        const sensorSelect = document.createElement('select');
        sensorSelect.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            margin-bottom: 20px;
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
            border: 1px solid #ddd;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        cancelButton.onclick = () => {
            dialog.remove();
            this.bindingDialog = null;
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
        `;
        bindButton.onclick = () => {
            const sensorId = sensorSelect.value;
            if (!sensorId) {
                alert('請選擇感測器');
                return;
            }
            this.createBinding(parseInt(sensorId));
            dialog.remove();
            this.bindingDialog = null;
        };
        buttonGroup.appendChild(bindButton);

        dialog.appendChild(buttonGroup);

        // 添加遮罩層
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 9999;
        `;
        overlay.onclick = () => {
            dialog.remove();
            overlay.remove();
            this.bindingDialog = null;
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
                alert('✅ 綁定成功！');
                // 重新載入綁定資料
                this.loadSensorsForCurrentModel();
            },
            error: (err) => {
                console.error('綁定失敗:', err);
                alert('❌ 綁定失敗：' + (err.error?.message || '未知錯誤'));
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
    private async getElementInfo(dbId: number): Promise<{
        dbId: number;
        name: string;
        urn: string;
    }> {
        return new Promise((resolve, reject) => {
            try {
                // 檢查 viewer 和 model 是否存在
                if (!this.viewer || !this.viewer.model) {
                    console.error('Viewer or model not available');
                    reject(new Error('Viewer or model not available'));
                    return;
                }

                const model = this.viewer.model;
                const tree = model.getInstanceTree();

                if (!tree) {
                    console.error('Instance tree not available');
                    reject(new Error('Instance tree not available'));
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
                    reject(new Error('Model URN not available'));
                    return;
                }

                // 獲取元件名稱
                tree.getNodeName(dbId, (name: string) => {
                    resolve({
                        dbId,
                        name: name || `Element ${dbId}`,
                        urn
                    });
                });
            } catch (error) {
                console.error('Error in getElementInfo:', error);
                reject(error);
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
