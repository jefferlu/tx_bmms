import { Injectable, NgZone } from '@angular/core';

const endpoint = environment.api;
import { environment } from 'environments/environment';
import { Observable, Observer } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class SseService {

    constructor(private _ngZone: NgZone) { }

    sse(method: string, kwargs?: any): Observable<any> {

        let queryString = '';
        for (let key in kwargs) {
            if (queryString === '')
                queryString = `/?${key}=${kwargs[key]}`
            else
                queryString += `&${key}=${kwargs[key]}`

        }

        let url = `${endpoint}/${method}${queryString}`;
        return new Observable((observer: Observer<any>) => {
            const eventSource: EventSource = new EventSource(url);
            eventSource.onmessage = (event: MessageEvent) => {
                this._ngZone.run(() => {
                    observer.next(event);
                })
            }

            eventSource.onerror = (error) => {
                this._ngZone.run(() => {
                    console.error('SSE Connection Error:', error);
                    observer.error(error);
                    eventSource.close();
                });
            }

            return () => {
                eventSource.close();
                console.log('SSE close.')
            };
        });
    }
}
