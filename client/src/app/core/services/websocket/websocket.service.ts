import { Injectable, NgZone } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class WebsocketService {

    private _socket$: WebSocketSubject<any>;
    private _method: string;

    constructor(private _ngZone: NgZone) { }

    set method(value: string) {

        this._method = value;

        const protocal = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocal}//${window.location.host}/ws/${this._method}`;
        this._socket$ = webSocket(url);
        console.log(url, 'connected')
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
