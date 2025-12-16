import { Injector } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { SensorService, Sensor, SensorData } from 'app/core/services/sensors';

declare const Autodesk: any;

/**
 * IoT 感測器管理面板
 * 顯示感測器列表、即時數據和綁定管理
 */
export class IotPanel extends Autodesk.Viewing.UI.DockingPanel {
    private _translocoService: TranslocoService;
    private _sensorService: SensorService;

    private viewer: any;
    private extension: any;

    private searchField: HTMLInputElement;
    private filterSelect: HTMLSelectElement;
    private sensorListContainer: HTMLDivElement;
    private refreshButton: HTMLButtonElement;
    private toggleMarkersButton: HTMLButtonElement;

    private sensors: Sensor[] = [];
    private realtimeData: { [sensorId: string]: SensorData } = {};
    private markersVisible: boolean = true;

    constructor(viewer: any, extension: any, container: HTMLElement, id: string, title: string, injector: Injector) {
        super(container, id, title);

        this._translocoService = injector.get(TranslocoService);
        this._sensorService = injector.get(SensorService);

        this.viewer = viewer;
        this.extension = extension;

        // 設置面板樣式
        this.container.classList.add('docking-panel-container-solid-color-a');
        this.container.style.top = '80px';
        this.container.style.right = '10px';
        this.container.style.width = '350px';
        this.container.style.height = '600px';
        this.container.style.resize = 'both';

        this.initializeContent();
        this.loadSensors();
    }

    /**
     * 初始化面板內容
     */
    private initializeContent(): void {
        const content = document.createElement('div');
        content.className = 'p-4 h-full flex flex-col';

        // 工具欄
        const toolbar = this.createToolbar();
        content.appendChild(toolbar);

        // 搜索和過濾
        const searchBar = this.createSearchBar();
        content.appendChild(searchBar);

        // 感測器列表容器
        this.sensorListContainer = document.createElement('div');
        this.sensorListContainer.className = 'flex-1 overflow-y-auto mt-2 space-y-2';
        content.appendChild(this.sensorListContainer);

        this.container.appendChild(content);
    }

    /**
     * 創建工具欄
     */
    private createToolbar(): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.className = 'flex justify-between items-center mb-4';

        // 標題
        const title = document.createElement('h3');
        title.className = 'text-lg font-bold';
        title.innerText = 'IoT 感測器';
        toolbar.appendChild(title);

        // 按鈕組
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'flex space-x-2';

        // 刷新按鈕
        this.refreshButton = document.createElement('button');
        this.refreshButton.type = 'button';
        this.refreshButton.innerHTML = '🔄';
        this.refreshButton.title = '刷新';
        this.refreshButton.className = 'px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600';
        this.refreshButton.onclick = () => this.loadSensors();
        buttonGroup.appendChild(this.refreshButton);

        // 切換標記顯示按鈕
        this.toggleMarkersButton = document.createElement('button');
        this.toggleMarkersButton.type = 'button';
        this.toggleMarkersButton.innerHTML = '👁️';
        this.toggleMarkersButton.title = '切換標記顯示';
        this.toggleMarkersButton.className = 'px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600';
        this.toggleMarkersButton.onclick = () => this.toggleMarkers();
        buttonGroup.appendChild(this.toggleMarkersButton);

        toolbar.appendChild(buttonGroup);

        return toolbar;
    }

    /**
     * 創建搜索欄
     */
    private createSearchBar(): HTMLElement {
        const searchBar = document.createElement('div');
        searchBar.className = 'space-y-2';

        // 搜索輸入框
        this.searchField = document.createElement('input');
        this.searchField.type = 'text';
        this.searchField.placeholder = '搜索感測器...';
        this.searchField.className = 'w-full border rounded px-3 py-2 text-sm';
        this.searchField.oninput = () => this.filterSensors();
        searchBar.appendChild(this.searchField);

        // 類型過濾下拉選單
        this.filterSelect = document.createElement('select');
        this.filterSelect.className = 'w-full border rounded px-3 py-2 text-sm';
        this.filterSelect.onchange = () => this.filterSensors();

        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.text = '所有類型';
        this.filterSelect.appendChild(allOption);

        // 添加感測器類型選項
        const types = ['temperature', 'humidity', 'co2', 'power', 'pressure', 'flow'];
        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.text = this.getTypeDisplayName(type);
            this.filterSelect.appendChild(option);
        });

        searchBar.appendChild(this.filterSelect);

        return searchBar;
    }

    /**
     * 載入感測器列表
     */
    private loadSensors(): void {
        this._sensorService.getSensors({ is_active: true }).subscribe({
            next: (sensors) => {
                this.sensors = sensors;
                this.filterSensors();
            },
            error: (err) => {
                console.error('載入感測器失敗:', err);
            }
        });
    }

    /**
     * 載入所有感測器 (未選擇元件時)
     */
    public loadAllSensors(): void {
        this.loadSensors();
    }

    /**
     * 載入指定元件的感測器 (選擇元件時)
     */
    public loadSensorsForElement(elementDbId: number, modelUrn: string): void {
        // 取得該元件的所有感測器綁定
        const bindings = this.extension.getBindingsForElement(elementDbId, modelUrn);

        if (bindings.length === 0) {
            // 沒有綁定，顯示提示訊息
            this.showNoBindingMessage();
        } else {
            // 有綁定，載入並顯示這些感測器
            const sensorIds = bindings.map(b => b.sensor);
            this.loadSensorsByIds(sensorIds);
        }
    }

    /**
     * 根據 ID 列表載入感測器
     */
    private loadSensorsByIds(sensorIds: number[]): void {
        this._sensorService.getSensors({ is_active: true }).subscribe({
            next: (allSensors) => {
                // 過濾出綁定的感測器
                this.sensors = allSensors.filter(s => sensorIds.includes(s.id));
                this.filterSensors();
            },
            error: (err) => {
                console.error('載入感測器失敗:', err);
            }
        });
    }

    /**
     * 顯示無綁定訊息
     */
    private showNoBindingMessage(): void {
        this.sensors = [];
        this.sensorListContainer.innerHTML = '';

        const messageContainer = document.createElement('div');
        messageContainer.className = 'flex flex-col items-center justify-center h-full text-center p-8';

        const icon = document.createElement('div');
        icon.className = 'text-6xl mb-4';
        icon.innerHTML = '🔌';
        messageContainer.appendChild(icon);

        const message = document.createElement('div');
        message.className = 'text-lg font-semibold text-gray-700 mb-2';
        message.innerText = '實體未綁定 sensor';
        messageContainer.appendChild(message);

        const hint = document.createElement('div');
        hint.className = 'text-sm text-gray-500';
        hint.innerText = '請在系統管理中設定感測器綁定';
        messageContainer.appendChild(hint);

        this.sensorListContainer.appendChild(messageContainer);
    }

    /**
     * 過濾感測器
     */
    private filterSensors(): void {
        const searchTerm = this.searchField.value.toLowerCase();
        const filterType = this.filterSelect.value;

        const filtered = this.sensors.filter(sensor => {
            const matchSearch = !searchTerm ||
                sensor.sensor_id.toLowerCase().includes(searchTerm) ||
                sensor.name.toLowerCase().includes(searchTerm);

            const matchType = !filterType || sensor.sensor_type === filterType;

            return matchSearch && matchType;
        });

        this.renderSensorList(filtered);
    }

    /**
     * 渲染感測器列表
     */
    private renderSensorList(sensors: Sensor[]): void {
        this.sensorListContainer.innerHTML = '';

        if (sensors.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'text-center text-gray-500 py-4';
            emptyMessage.innerText = '無感測器數據';
            this.sensorListContainer.appendChild(emptyMessage);
            return;
        }

        sensors.forEach(sensor => {
            const sensorCard = this.createSensorCard(sensor);
            this.sensorListContainer.appendChild(sensorCard);
        });
    }

    /**
     * 創建感測器卡片
     */
    private createSensorCard(sensor: Sensor): HTMLElement {
        const card = document.createElement('div');
        card.className = 'border rounded p-3 bg-white hover:bg-gray-50 cursor-pointer transition-colors';

        // 感測器資訊頭部
        const header = document.createElement('div');
        header.className = 'flex justify-between items-start mb-2';

        const info = document.createElement('div');
        info.className = 'flex-1';

        const name = document.createElement('div');
        name.className = 'font-semibold text-sm';
        name.innerText = sensor.name;
        info.appendChild(name);

        const id = document.createElement('div');
        id.className = 'text-xs text-gray-600';
        id.innerText = sensor.sensor_id;
        info.appendChild(id);

        header.appendChild(info);

        // 狀態指示器
        const statusIndicator = document.createElement('div');
        statusIndicator.className = 'w-3 h-3 rounded-full';
        statusIndicator.id = `status-${sensor.sensor_id}`;
        statusIndicator.style.backgroundColor = '#808080'; // 默認灰色
        header.appendChild(statusIndicator);

        card.appendChild(header);

        // 感測器數據顯示
        const dataDisplay = document.createElement('div');
        dataDisplay.className = 'text-lg font-mono';
        dataDisplay.id = `data-${sensor.sensor_id}`;
        dataDisplay.innerText = '-- ' + sensor.unit;
        card.appendChild(dataDisplay);

        // 類型標籤
        const typeLabel = document.createElement('span');
        typeLabel.className = 'inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded';
        typeLabel.innerText = this.getTypeDisplayName(sensor.sensor_type);
        card.appendChild(typeLabel);

        // 點擊事件 - 聚焦到對應的 BIM 元件
        card.onclick = () => this.onSensorClick(sensor);

        return card;
    }

    /**
     * 感測器點擊事件
     */
    private onSensorClick(sensor: Sensor): void {
        // 通知 Extension 聚焦到該感測器
        this.extension.focusOnSensor(sensor.sensor_id);
    }

    /**
     * 更新感測器即時數據
     */
    public updateSensorData(sensorId: string, data: SensorData): void {
        this.realtimeData[sensorId] = data;

        // 更新 UI 顯示
        const dataElement = document.getElementById(`data-${sensorId}`);
        const statusElement = document.getElementById(`status-${sensorId}`);

        if (dataElement) {
            dataElement.innerText = `${data.value.toFixed(2)} ${data.unit}`;
        }

        if (statusElement) {
            const statusColors = {
                normal: '#00ff00',
                warning: '#ffa500',
                error: '#ff0000',
                offline: '#808080'
            };
            statusElement.style.backgroundColor = statusColors[data.status] || statusColors.offline;
        }
    }

    /**
     * 切換標記顯示
     */
    private toggleMarkers(): void {
        this.markersVisible = !this.markersVisible;
        this.extension.setMarkersVisible(this.markersVisible);

        this.toggleMarkersButton.innerHTML = this.markersVisible ? '👁️' : '👁️‍🗨️';
    }

    /**
     * 獲取類型顯示名稱
     */
    private getTypeDisplayName(type: string): string {
        const typeNames: { [key: string]: string } = {
            temperature: '溫度',
            humidity: '濕度',
            co2: 'CO2',
            power: '功率',
            pressure: '壓力',
            flow: '流量',
            voltage: '電壓',
            current: '電流',
            occupancy: '佔用率'
        };
        return typeNames[type] || type;
    }

    /**
     * 清理資源
     */
    public dispose(): void {
        // 清理事件監聽器和資源
        this.sensors = [];
        this.realtimeData = {};
    }
}
