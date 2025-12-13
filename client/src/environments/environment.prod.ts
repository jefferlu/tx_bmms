export const environment = {
    production: true,
    host: '',
    api: 'api',
    apiUrl: 'api',  // 標準化 API URL
    elfinder: '',
    websocket: '',
    // MQTT Broker 設定 (IoT 感測器)
    mqtt: {
        host: 'giantcld.com',
        port: 8084,                        // WebSocket SSL 端口
        protocol: 'wss' as 'ws' | 'wss',   // 生產環境使用 wss
        reconnectPeriod: 5000,             // 5秒重連
        keepalive: 60                      // 60秒心跳
    },
    // 感測器設定
    sensor: {
        updateInterval: 5000,              // 更新間隔 (毫秒)
        retentionHours: 168                // 資料保留時間 (7天)
    },
    local_storage: {
        user: 'tx_bmms_user',
        language: 'tx_bmms_languages',
        aps: 'tx_bmms_aps'
    }
};
