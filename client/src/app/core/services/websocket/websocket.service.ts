import { Injectable, NgZone } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class WebsocketService {
    private _sockets: Map<string, WebSocketSubject<any>> = new Map();

    constructor(private _ngZone: NgZone) {}

    // 建立指定通道的 WebSocket 連線
    connect(channel: string = 'progress'): void {
        if (this._sockets.has(channel)) {
            this.close(channel); // 如果該通道已有連線，先關閉
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const baseUrl = environment.websocket || `${protocol}//${window.location.host}`;
        const url = `${baseUrl}/ws/${channel}`;

        const socket = webSocket(url);
        this._sockets.set(channel, socket);
        console.log(url, 'connected');
    }

    // 監聽指定通道的消息
    onMessage(channel: string = 'progress'): Observable<any> {
        const socket = this._sockets.get(channel);
        if (!socket) {
            throw new Error(`WebSocket for channel "${channel}" is not connected. Please call connect("${channel}") first.`);
        }

        return new Observable((observer) => {
            socket.subscribe({
                next: (message) => {
                    this._ngZone.run(() => {
                        observer.next(message);
                    });
                },
                error: (err) => {
                    this._ngZone.run(() => {
                        observer.error(err);
                    });
                },
                complete: () => {
                    this._ngZone.run(() => {
                        observer.complete();
                    });
                }
            });
        });
    }

    // 向指定通道發送消息
    sendMessage(channel: string, message: any): void {
        const socket = this._sockets.get(channel);
        if (!socket) {
            throw new Error(`WebSocket for channel "${channel}" is not connected.`);
        }
        socket.next(message);
    }

    // 關閉指定通道的連線
    close(channel: string): void {
        const socket = this._sockets.get(channel);
        if (socket && !socket.closed) {
            socket.complete();
            this._sockets.delete(channel);
        }
    }

    // 關閉所有通道的連線（可選）
    closeAll(): void {
        this._sockets.forEach((socket, channel) => {
            if (!socket.closed) {
                socket.complete();
            }
        });
        this._sockets.clear();
    }
}