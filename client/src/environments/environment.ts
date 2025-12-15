// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
    production: false,
    host: 'http://localhost:8000/',
    // host: 'assets',
    api: 'http://localhost:8000/api',
    apiUrl: 'http://localhost:8000/api',  // 新增: 標準化 API URL
    websocket: 'ws://localhost:8000',
    elfinder: 'https://bmms.giantcld.com',
    // MQTT Broker 設定 (IoT 感測器)
    mqtt: {
        host: 'giantcld.com',
        port: 8083,                        // WebSocket 端口
        protocol: 'ws' as 'ws' | 'wss',    // 開發環境使用 ws
        path: '/mqtt',                     // VerneMQ/EMQX 需要 /mqtt 路徑
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

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
