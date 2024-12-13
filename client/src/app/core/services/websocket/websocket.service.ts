import { Injectable, NgZone } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';

const websocketUrl = environment.websocket;

@Injectable({
    providedIn: 'root'
})
export class WebsocketService {

    private _socket$: WebSocketSubject<any>;

    constructor(private _ngZone: NgZone) {
        let url;
        if (websocketUrl) {
            url = websocketUrl;
        }
        else {
            const protocal = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            url = `${protocal}//${window.location.host}/ws/progress`;
        }

        this._socket$ = webSocket(url);
        console.log(url)
        console.log(this._socket$)
    }

    onMessage(): Observable<any> {
        return new Observable((observer) => {
            this._socket$.subscribe({
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

    sendMessage(message: any): void {
        this._socket$.next(message);
    }

    close(): void {
        this._socket$.complete();
    }
}
