import { Injector } from '@angular/core';
import { Subscription } from 'rxjs';
import { SensorService, Sensor, SensorBimBinding, SensorData } from 'app/core/services/sensors';
import { MqttService } from 'app/core/services/mqtt';
import { environment } from 'environments/environment';
import { IotPanel } from './iot-panel';
import { SensorMarker } from './sensor-marker';

declare const Autodesk: any;
declare const THREE: any;

/**
 * IoT Extension for Autodesk Forge Viewer
 * 整合感測器數據到 BIM 模型中
 */
export class IotExtension extends Autodesk.Viewing.Extension {
    private injector: Injector;
    private sensorService: SensorService;
    private mqttService: MqttService;

    private iotPanel: IotPanel | null = null;
    private markers: Map<string, SensorMarker> = new Map();
    private bindings: Map<string, SensorBimBinding[]> = new Map();

    private mqttSubscription: Subscription | null = null;
    private isInitialized: boolean = false;
    private currentModelUrn: string | null = null;
    private selectedElementDbId: number | null = null;
    private selectedElementInfo: {
        dbId: number;
        name: string;
        urn: string;
    } | null = null;
    private isInSelectionMode: boolean = false;

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
            this.mqttService = this.injector.get(MqttService);

            if (!this.sensorService) {
                console.error('Failed to get SensorService from Injector');
            }
            if (!this.mqttService) {
                console.error('Failed to get MqttService from Injector');
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

        // 初始化 MQTT 連接
        this.initializeMqtt();

        // 創建工具欄按鈕
        this.createToolbarButton();

        // 監聽元件選擇事件
        this.viewer.addEventListener(
            Autodesk.Viewing.SELECTION_CHANGED_EVENT,
            this.onSelectionChanged.bind(this)
        );

        // 監聽來自 sensor-bindings 頁面的選擇模式事件
        window.addEventListener('sensor-binding-select-mode', ((event: CustomEvent) => {
            this.isInSelectionMode = event.detail.active;
        }) as EventListener);

        console.log('IoT Extension loaded');
        return true;
    }

    /**
     * Extension 卸載時調用
     */
    public unload(): boolean {
        console.log('IoT Extension unloading...');

        // 清理 MQTT 訂閱
        if (this.mqttSubscription) {
            this.mqttSubscription.unsubscribe();
        }

        // 斷開 MQTT 連接
        if (this.mqttService) {
            this.mqttService.disconnect();
        }

        // 清理標記
        this.clearAllMarkers();

        // 移除面板
        if (this.iotPanel) {
            this.iotPanel.uninitialize();
            this.iotPanel = null;
        }

        console.log('IoT Extension unloaded');
        return true;
    }

    /**
     * 初始化 MQTT 連接
     */
    private async initializeMqtt(): Promise<void> {
        try {
            // 檢查 mqttService 是否已初始化
            if (!this.mqttService) {
                console.error('MqttService not available');
                return;
            }

            // 連接到 MQTT Broker
            await this.mqttService.connect({
                host: environment.mqtt.host,
                port: environment.mqtt.port,
                protocol: environment.mqtt.protocol,
                path: environment.mqtt.path,
                reconnectPeriod: environment.mqtt.reconnectPeriod,
                keepalive: environment.mqtt.keepalive
            });

            console.log('MQTT connected successfully');

            // 訂閱所有感測器 topics
            await this.mqttService.subscribeMultiple([
                'sensors/+/+',  // 訂閱所有感測器
            ]);

            // 監聽 MQTT 訊息
            this.mqttSubscription = this.mqttService.messages$.subscribe(message => {
                this.onMqttMessage(message);
            });

        } catch (error) {
            console.error('MQTT initialization failed:', error);
            console.error('Error details:', error);
        }
    }

    /**
     * 處理 MQTT 訊息
     */
    private onMqttMessage(message: any): void {
        try {
            const payload = JSON.parse(message.payload.toString());
            const sensorId = payload.sensor_id;

            if (!sensorId) {
                return;
            }

            const sensorData: SensorData = {
                sensor_id: sensorId,
                value: payload.value,
                unit: payload.unit,
                status: payload.status || 'normal',
                timestamp: payload.timestamp || new Date().toISOString()
            };

            // 更新標記
            const marker = this.markers.get(sensorId);
            if (marker) {
                marker.updateData(sensorData);
            }

            // 更新面板顯示
            if (this.iotPanel) {
                this.iotPanel.updateSensorData(sensorId, sensorData);
            }

        } catch (error) {
            console.error('Failed to process MQTT message:', error);
        }
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

        // 創建 IoT 按鈕
        const iotButton = new Autodesk.Viewing.UI.Button('iot-panel-button');
        iotButton.setToolTip('IoT 感測器');
        iotButton.setIcon('adsk-icon-iot');
        iotButton.onClick = () => this.togglePanel();

        iotGroup.addControl(iotButton);
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

                // 如果在選擇模式下，發送選擇事件給 sensor-bindings 頁面
                if (this.isInSelectionMode) {
                    window.dispatchEvent(new CustomEvent('viewer-element-selected', {
                        detail: info
                    }));
                }

                // 如果面板已開啟，更新顯示
                if (this.iotPanel && this.iotPanel.isVisible()) {
                    this.iotPanel.updateSelectedElement(info);
                }
            });
        } else {
            this.selectedElementDbId = null;
            this.selectedElementInfo = null;

            // 如果面板已開啟，清除選中元件資訊
            if (this.iotPanel && this.iotPanel.isVisible()) {
                this.iotPanel.updateSelectedElement(null);
            }
        }
    }

    /**
     * 切換面板顯示
     */
    private togglePanel(): void {
        if (!this.iotPanel) {
            this.createPanel();
        }

        if (this.iotPanel) {
            // 傳遞當前選擇的元件到面板
            if (this.selectedElementDbId !== null) {
                this.iotPanel.loadSensorsForElement(this.selectedElementDbId, this.currentModelUrn || '');
            } else {
                this.iotPanel.loadAllSensors();
            }
            this.iotPanel.setVisible(!this.iotPanel.isVisible());
        }

        // 首次打開面板時載入感測器
        if (!this.isInitialized) {
            this.loadSensorsForCurrentModel();
            this.isInitialized = true;
        }
    }

    /**
     * 創建 IoT 面板
     */
    private createPanel(): void {
        const container = this.viewer.container;
        this.iotPanel = new IotPanel(
            this.viewer,
            this,
            container,
            'iot-panel',
            'IoT 感測器',
            this.injector
        );
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
        const tree = this.viewer.model.getInstanceTree();
        const urn = this.currentModelUrn || this.viewer.model.getData().urn;

        return new Promise((resolve) => {
            tree.getNodeName(dbId, (name: string) => {
                resolve({
                    dbId,
                    name: name || `Element ${dbId}`,
                    urn
                });
            });
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
