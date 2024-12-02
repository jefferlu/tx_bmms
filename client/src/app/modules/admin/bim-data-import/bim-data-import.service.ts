import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone } from '@angular/core';
import { environment } from 'environments/environment';
import { BehaviorSubject, Observable, Observer, catchError, of, switchMap, tap } from 'rxjs';

const endpoint = environment.forgeUrl;

@Injectable({
    providedIn: 'root'
})
export class BimDataImportService {

    private _objects: BehaviorSubject<any> = new BehaviorSubject(null);
    private _object: BehaviorSubject<any> = new BehaviorSubject(null);

    constructor(
        private _httpClient: HttpClient,
        private _ngZone: NgZone
    ) { }

    uploadFile(file: File): Observable<any> {

        const url = `${endpoint}/upload`;
        const formData = new FormData();
        formData.append('file', file, encodeURIComponent(file.name));


        return this._httpClient.post(url, formData, {
            reportProgress: true,
            observe: 'events'
        }).pipe(
            switchMap((response: any) => {
                return of(response);
            }),
            catchError(error => {
                console.error('Error uploading file:', error);
                throw error; // Rethrow the error to propagate it to the subscriber
            })
        );
    }

    getObjects(data: any): Observable<any> {
        const url = `${endpoint}/objects`;

        return this._httpClient.post<any>(url, data);
    }

    getObject(name: string): Observable<any> {
        const url = `${endpoint}/object`;
        return this._httpClient.post<any>(url, { 'name': name });
    }

    sse(action: string, name: string, credentials?: any): Observable<any> {

        const url = `${endpoint}/${action}?name=${name}&clientId=${credentials.clientId}&clientSecret=${credentials.clientSecret}&bucketKey=${credentials.bucketKey}`;
        // const url = `http://localhost:3000/${action}?name=${name}&clientId=${credentials.clientId}&clientSecret=${credentials.clientSecret}&bucketKey=${credentials.bucketKey}`;

        console.log(url)

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
                console.log('event source close')
            };
        });
    }
}
