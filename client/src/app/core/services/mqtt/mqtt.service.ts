import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { MqttMessage } from '../sensors/sensor.types';

/**
 * MQTT WebSocket Service
 *
 * 注意: 需要安装 mqtt 库
 * npm install mqtt --save
 *
 * 或者使用 paho-mqtt:
 * npm install paho-mqtt --save
 */

// 動態導入 MQTT (避免在未安裝時出錯)
declare const require: any;
let mqtt: any;
try {
    mqtt = require('mqtt');
} catch (e) {
    console.warn('MQTT library not found. Please install: npm install mqtt');
}

export interface MqttConnectionOptions {
    host: string;
    port: number;
    protocol?: 'ws' | 'wss';
    clientId?: string;
    username?: string;
    password?: string;
    clean?: boolean;
    reconnectPeriod?: number;
    keepalive?: number;
}

@Injectable({
    providedIn: 'root'
})
export class MqttService implements OnDestroy {
    private client: any = null;
    private messageSubject = new Subject<MqttMessage>();
    private connectedSubject = new BehaviorSubject<boolean>(false);
    private subscribedTopics: Set<string> = new Set();

    public messages$ = this.messageSubject.asObservable();
    public connected$ = this.connectedSubject.asObservable();

    constructor() {}

    /**
     * 連接到 MQTT Broker
     */
    connect(options: MqttConnectionOptions): Promise<void> {
        if (!mqtt) {
            return Promise.reject(new Error('MQTT library not installed'));
        }

        if (this.client && this.isConnected()) {
            console.log('Already connected to MQTT broker');
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const protocol = options.protocol || 'ws';
            const url = `${protocol}://${options.host}:${options.port}`;

            const connectOptions = {
                clientId: options.clientId || `tx_bmms_web_${Math.random().toString(16).substr(2, 8)}`,
                clean: options.clean !== undefined ? options.clean : true,
                reconnectPeriod: options.reconnectPeriod || 5000,
                keepalive: options.keepalive || 60,
                username: options.username,
                password: options.password
            };

            console.log(`Connecting to MQTT broker at ${url}...`);

            this.client = mqtt.connect(url, connectOptions);

            this.client.on('connect', () => {
                console.log('✓ Connected to MQTT broker');
                this.connectedSubject.next(true);
                resolve();
            });

            this.client.on('error', (error: any) => {
                console.error('MQTT connection error:', error);
                this.connectedSubject.next(false);
                reject(error);
            });

            this.client.on('disconnect', () => {
                console.log('Disconnected from MQTT broker');
                this.connectedSubject.next(false);
            });

            this.client.on('reconnect', () => {
                console.log('Reconnecting to MQTT broker...');
            });

            this.client.on('message', (topic: string, payload: Buffer) => {
                try {
                    const data = JSON.parse(payload.toString());
                    this.messageSubject.next({
                        topic,
                        payload: data,
                        timestamp: new Date()
                    });
                } catch (error) {
                    console.error('Error parsing MQTT message:', error);
                    // 如果不是 JSON，也發送原始訊息
                    this.messageSubject.next({
                        topic,
                        payload: payload.toString(),
                        timestamp: new Date()
                    });
                }
            });
        });
    }

    /**
     * 斷開連接
     */
    disconnect(): Promise<void> {
        return new Promise((resolve) => {
            if (this.client) {
                this.client.end(true, () => {
                    console.log('Disconnected from MQTT broker');
                    this.connectedSubject.next(false);
                    this.subscribedTopics.clear();
                    this.client = null;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * 訂閱 topic
     */
    subscribe(topic: string, qos: 0 | 1 | 2 = 1): Promise<void> {
        if (!this.client || !this.isConnected()) {
            return Promise.reject(new Error('Not connected to MQTT broker'));
        }

        return new Promise((resolve, reject) => {
            this.client.subscribe(topic, { qos }, (error: any) => {
                if (error) {
                    console.error(`Failed to subscribe to topic ${topic}:`, error);
                    reject(error);
                } else {
                    console.log(`✓ Subscribed to topic: ${topic}`);
                    this.subscribedTopics.add(topic);
                    resolve();
                }
            });
        });
    }

    /**
     * 取消訂閱 topic
     */
    unsubscribe(topic: string): Promise<void> {
        if (!this.client || !this.isConnected()) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this.client.unsubscribe(topic, (error: any) => {
                if (error) {
                    console.error(`Failed to unsubscribe from topic ${topic}:`, error);
                    reject(error);
                } else {
                    console.log(`Unsubscribed from topic: ${topic}`);
                    this.subscribedTopics.delete(topic);
                    resolve();
                }
            });
        });
    }

    /**
     * 發布訊息
     */
    publish(topic: string, message: any, qos: 0 | 1 | 2 = 1): Promise<void> {
        if (!this.client || !this.isConnected()) {
            return Promise.reject(new Error('Not connected to MQTT broker'));
        }

        const payload = typeof message === 'string' ? message : JSON.stringify(message);

        return new Promise((resolve, reject) => {
            this.client.publish(topic, payload, { qos }, (error: any) => {
                if (error) {
                    console.error(`Failed to publish to topic ${topic}:`, error);
                    reject(error);
                } else {
                    console.log(`Published to topic: ${topic}`);
                    resolve();
                }
            });
        });
    }

    /**
     * 檢查是否已連接
     */
    isConnected(): boolean {
        return this.client && this.client.connected;
    }

    /**
     * 取得已訂閱的 topics
     */
    getSubscribedTopics(): string[] {
        return Array.from(this.subscribedTopics);
    }

    /**
     * 取得特定 topic 的訊息流
     */
    getMessagesForTopic(topic: string): Observable<MqttMessage> {
        return new Observable(observer => {
            const subscription = this.messages$.subscribe(message => {
                if (message.topic === topic) {
                    observer.next(message);
                }
            });

            return () => subscription.unsubscribe();
        });
    }

    /**
     * 訂閱多個 topics
     */
    async subscribeMultiple(topics: string[], qos: 0 | 1 | 2 = 1): Promise<void> {
        const promises = topics.map(topic => this.subscribe(topic, qos));
        await Promise.all(promises);
    }

    /**
     * 取消訂閱多個 topics
     */
    async unsubscribeMultiple(topics: string[]): Promise<void> {
        const promises = topics.map(topic => this.unsubscribe(topic));
        await Promise.all(promises);
    }

    /**
     * 清理資源
     */
    ngOnDestroy(): void {
        this.disconnect();
        this.messageSubject.complete();
        this.connectedSubject.complete();
    }
}
