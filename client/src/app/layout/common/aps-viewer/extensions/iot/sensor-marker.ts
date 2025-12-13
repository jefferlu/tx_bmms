import { SensorData, SensorDataStatus } from 'app/core/services/sensors';

declare const THREE: any;

/**
 * 感測器標記類別
 * 在 3D 模型上顯示感測器的位置和狀態
 */
export class SensorMarker {
    private viewer: any;
    private sensorId: string;
    private dbId: number;
    private modelUrn: string;
    private mesh: any;
    private label: any;
    private overlay: any;
    private position: THREE.Vector3;
    private currentData: SensorData | null = null;

    // 狀態顏色配置
    private static readonly STATUS_COLORS = {
        normal: 0x00ff00,    // 綠色
        warning: 0xffa500,   // 橙色
        error: 0xff0000,     // 紅色
        offline: 0x808080    // 灰色
    };

    constructor(viewer: any, sensorId: string, dbId: number, modelUrn: string, position: THREE.Vector3) {
        this.viewer = viewer;
        this.sensorId = sensorId;
        this.dbId = dbId;
        this.modelUrn = modelUrn;
        this.position = position;
        this.createMarker();
    }

    /**
     * 創建標記的 3D 物件
     */
    private createMarker(): void {
        // 創建覆蓋層（如果不存在）
        if (!this.viewer.overlays.hasScene('iot-sensors')) {
            this.viewer.overlays.addScene('iot-sensors');
        }

        // 創建球體作為標記
        const geometry = new THREE.SphereGeometry(0.5, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: SensorMarker.STATUS_COLORS.offline,
            transparent: true,
            opacity: 0.8
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);

        // 添加到覆蓋層
        this.viewer.overlays.addMesh(this.mesh, 'iot-sensors');

        // 創建標籤（可選）
        // this.createLabel();
    }

    /**
     * 創建標記的文字標籤
     */
    private createLabel(): void {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;

        if (context) {
            context.font = 'Bold 24px Arial';
            context.fillStyle = 'white';
            context.fillText(this.sensorId, 10, 40);
        }

        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;

        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        this.label = new THREE.Sprite(spriteMaterial);
        this.label.position.copy(this.position);
        this.label.position.y += 1; // 標籤在標記上方
        this.label.scale.set(2, 0.5, 1);

        this.viewer.overlays.addMesh(this.label, 'iot-sensors');
    }

    /**
     * 更新感測器數據和視覺狀態
     */
    public updateData(data: SensorData): void {
        this.currentData = data;
        this.updateVisuals();
    }

    /**
     * 更新視覺狀態（顏色、動畫）
     */
    private updateVisuals(): void {
        if (!this.currentData || !this.mesh) {
            return;
        }

        // 根據狀態更新顏色
        const color = SensorMarker.STATUS_COLORS[this.currentData.status] || SensorMarker.STATUS_COLORS.offline;
        this.mesh.material.color.setHex(color);

        // 添加脈動動畫（警告或錯誤狀態）
        if (this.currentData.status === 'warning' || this.currentData.status === 'error') {
            this.addPulseAnimation();
        } else {
            this.removePulseAnimation();
        }

        // 請求重繪
        this.viewer.impl.invalidate(true);
    }

    /**
     * 添加脈動動畫
     */
    private addPulseAnimation(): void {
        // 簡單的縮放動畫
        if (!this.mesh.userData.isPulsing) {
            this.mesh.userData.isPulsing = true;
            this.mesh.userData.pulseTime = 0;
        }
    }

    /**
     * 移除脈動動畫
     */
    private removePulseAnimation(): void {
        if (this.mesh.userData.isPulsing) {
            this.mesh.userData.isPulsing = false;
            this.mesh.scale.set(1, 1, 1);
        }
    }

    /**
     * 動畫更新（由 Extension 每幀調用）
     */
    public animate(deltaTime: number): void {
        if (this.mesh && this.mesh.userData.isPulsing) {
            this.mesh.userData.pulseTime += deltaTime;
            const scale = 1 + Math.sin(this.mesh.userData.pulseTime * 3) * 0.2;
            this.mesh.scale.set(scale, scale, scale);
            this.viewer.impl.invalidate(true);
        }
    }

    /**
     * 高亮顯示標記
     */
    public highlight(enabled: boolean): void {
        if (!this.mesh) {
            return;
        }

        if (enabled) {
            this.mesh.material.opacity = 1.0;
            this.mesh.scale.set(1.5, 1.5, 1.5);
        } else {
            this.mesh.material.opacity = 0.8;
            this.mesh.scale.set(1, 1, 1);
        }

        this.viewer.impl.invalidate(true);
    }

    /**
     * 顯示/隱藏標記
     */
    public setVisible(visible: boolean): void {
        if (this.mesh) {
            this.mesh.visible = visible;
            this.viewer.impl.invalidate(true);
        }

        if (this.label) {
            this.label.visible = visible;
        }
    }

    /**
     * 移除標記
     */
    public dispose(): void {
        if (this.mesh) {
            this.viewer.overlays.removeMesh(this.mesh, 'iot-sensors');
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.mesh = null;
        }

        if (this.label) {
            this.viewer.overlays.removeMesh(this.label, 'iot-sensors');
            this.label.material.map.dispose();
            this.label.material.dispose();
            this.label = null;
        }
    }

    /**
     * 獲取感測器 ID
     */
    public getSensorId(): string {
        return this.sensorId;
    }

    /**
     * 獲取 dbId
     */
    public getDbId(): number {
        return this.dbId;
    }

    /**
     * 獲取當前數據
     */
    public getCurrentData(): SensorData | null {
        return this.currentData;
    }

    /**
     * 獲取位置
     */
    public getPosition(): THREE.Vector3 {
        return this.position;
    }
}
