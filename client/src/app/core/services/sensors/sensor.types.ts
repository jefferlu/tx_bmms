/**
 * Sensor Types and Interfaces
 * IoT 感測器相關的 TypeScript 類型定義
 */

/**
 * 感測器類型
 */
export type SensorType =
    | 'temperature'  // 溫度
    | 'humidity'     // 濕度
    | 'pressure'     // 壓力
    | 'flow'         // 流量
    | 'power'        // 功率
    | 'voltage'      // 電壓
    | 'current'      // 電流
    | 'status'       // 狀態
    | 'occupancy'    // 佔用率
    | 'co2';         // CO2濃度

/**
 * 感測器數據狀態
 */
export type SensorDataStatus =
    | 'normal'    // 正常
    | 'warning'   // 警告
    | 'error'     // 錯誤
    | 'offline'   // 離線
    | 'unknown';  // 未知

/**
 * BIM 綁定位置類型
 */
export type PositionType =
    | 'center'   // 中心
    | 'top'      // 頂部
    | 'bottom'   // 底部
    | 'custom';  // 自訂

/**
 * 感測器主要資料結構
 */
export interface Sensor {
    id: number;
    sensor_id: string;
    name: string;
    description?: string;
    sensor_type: SensorType;
    sensor_type_display?: string; // 感測器類型的中文顯示名稱（由後端提供）
    unit: string;

    // MQTT 設定
    mqtt_topic: string;
    mqtt_qos: 0 | 1 | 2;

    // Modbus 設定 (可選)
    modbus_address?: number;
    modbus_register?: number;

    // API 設定 (可選)
    api_endpoint?: string;
    api_method?: string;

    // 顯示設定
    display_format: string;
    decimal_places: number;

    // 告警閾值
    warning_threshold_min?: number;
    warning_threshold_max?: number;
    error_threshold_min?: number;
    error_threshold_max?: number;

    // 資料轉換
    data_transform?: {
        scale?: number;
        offset?: number;
    };

    // 狀態
    is_active: boolean;
    last_seen?: string;

    // 時間戳
    created_at: string;
    updated_at: string;

    // 關聯資訊
    bim_bindings_count?: number;
    latest_value?: SensorData;
}

/**
 * 感測器即時數據
 */
export interface SensorData {
    sensor_id: string;
    value: number;
    unit: string;
    status: SensorDataStatus;
    timestamp: string;
    message?: string;
}

/**
 * 感測器與 BIM Element 的綁定
 */
export interface SensorBimBinding {
    id: number;
    sensor: number;
    sensor_detail?: Sensor;

    // BIM Element 識別
    model_urn: string;
    element_dbid: number;
    element_external_id?: string;
    element_name?: string;

    // 顯示位置
    position_type: PositionType;
    position_offset?: {
        x: number;
        y: number;
        z: number;
    };

    // 顯示樣式
    label_visible: boolean;
    icon_type?: string;
    color?: string;

    // 其他
    priority: number;
    notes?: string;
    is_active: boolean;

    // 時間戳
    created_at: string;
    updated_at: string;
}

/**
 * 感測器歷史數據日誌
 */
export interface SensorDataLog {
    id: number;
    sensor: number;
    sensor_name: string;
    value: number;
    raw_value?: number;
    status: SensorDataStatus;
    timestamp: string;
}

/**
 * MQTT 訊息
 */
export interface MqttMessage {
    topic: string;
    payload: any;
    timestamp: Date;
}

/**
 * 感測器查詢參數
 */
export interface SensorQueryParams {
    sensor_type?: SensorType;
    is_active?: boolean;
    search?: string;
    ordering?: string;
    page?: number;
    page_size?: number;
}

/**
 * 綁定查詢參數
 */
export interface BindingQueryParams {
    sensor?: number;
    model_urn?: string;
    is_active?: boolean;
    page?: number;
    page_size?: number;
}

/**
 * 批次建立綁定請求
 */
export interface BatchCreateBindingsRequest {
    bindings: Partial<SensorBimBinding>[];
}

/**
 * 批次建立綁定響應
 */
export interface BatchCreateBindingsResponse {
    created: SensorBimBinding[];
    errors: Array<{
        index: number;
        data: any;
        errors: any;
    }>;
}

/**
 * 批次刪除綁定請求
 */
export interface BatchDeleteBindingsRequest {
    binding_ids: number[];
}

/**
 * 批次刪除綁定響應
 */
export interface BatchDeleteBindingsResponse {
    deleted_count: number;
}

/**
 * 即時數據查詢結果
 */
export interface RealtimeDataResult {
    [sensor_id: string]: SensorData | null;
}
