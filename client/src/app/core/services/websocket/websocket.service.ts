import { Injectable, NgZone } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';

const endpoint = environment.websocket;

@Injectable({
    providedIn: 'root'
})
export class WebsocketService {

    private _socket$: WebSocketSubject<any>;

    constructor(private _ngZone: NgZone) {
        this._socket$ = webSocket(endpoint);
        console.log('websocket connect')
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
