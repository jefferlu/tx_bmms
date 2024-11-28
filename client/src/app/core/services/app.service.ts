import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, NgZone } from '@angular/core';
import { GtsConfirmationService } from '@gts/services/confirmation';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';

import { environment } from 'environments/environment';
import { catchError, firstValueFrom, Observable, Observer, of, switchMap, throwError } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';

const endpoint = environment.apiUrl;

@Injectable({
    providedIn: 'root'
})
export class AppService {

    private _ngZone = inject(NgZone);
    private _httpClient = inject(HttpClient);
    private _translocoService = inject(TranslocoService);
    private _gtsConfirmationService = inject(GtsConfirmationService);

    private socket$: WebSocketSubject<any>;

    get(method: string, params?: any, request?: any): Observable<any> {
        let queryString = '';
        for (let key in params) {
            if (queryString === '')
                queryString = `?${key}=${params[key]}`
            else
                queryString += `&${key}=${params[key]}`

        }

        let url = `${endpoint}/${method}/${queryString}`;
        // console.log(url)
        return this._httpClient.get(url, request).pipe(
            switchMap((res: any) => {
                return of(res);
            }),
            catchError((e) => {

                console.log(e)
                this._handleError(e);

                // Return false
                return throwError(() => e);
            })
        );
    }

    post(method: string, request: any): Observable<any> {
        return this._httpClient.post(`${endpoint}/${method}`, request).pipe(
            switchMap((res: any) => {
                return of(res);
            }),
            catchError((e) => {

                console.log(e);
                this._handleError(e);

                // Return false
                return throwError(() => e);
            })
        );
    }

    put(method: string, kwargs: any, request: any): Observable<any> {
        let queryString = '';
        for (let key in kwargs) {
            if (queryString === '')
                queryString = `?${key}=${kwargs[key]}`
            else
                queryString += `&${key}=${kwargs[key]}`

        }

        let url = `${endpoint}/${method}/${queryString}`;

        return this._httpClient.put(url, request).pipe(
            switchMap((res: any) => {
                return of(res);
            }),
            catchError((e) => {

                console.log(e)
                this._handleError(e);

                // Return false
                return throwError(() => e);
            })
        );
    }

    delete(method: string, pk: number): Observable<any> {
        let url = `${endpoint}/${method}/${pk}`;
        return this._httpClient.delete(url).pipe(
            switchMap((res: any) => {
                return of(res);
            }),
            catchError((e) => {

                console.log(e)
                this._handleError(e);

                // Return false
                return throwError(() => e);
            })
        );
    }

    sse(method: string, kwargs?: any): Observable<any> {

        let queryString = '';
        for (let key in kwargs) {
            if (queryString === '')
                queryString = `?${key}=${kwargs[key]}`
            else
                queryString += `&${key}=${kwargs[key]}`

        }

        let url = `${endpoint}/${method}/${queryString}`;
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


        });
    }

    private _handleError(error: HttpErrorResponse) {

        let messages = [];
        const errorCode = error.error?.code;

        // Get all i18n translation dictionary
        // const translations = await firstValueFrom(this._translocoService.selectTranslation());

        if (error.error instanceof ErrorEvent) {
            // Client-side or network error
            messages.push(`An error occurred: ${error.error.message}`);
        } else {
            if (error.status !== 401) { // 401 for sign-in

                if (errorCode) {
                    messages.push(this._translocoService.translate(errorCode));
                }
                // Server-side error
                else if (error.status === 400 && error.error) {
                    // 處理驗證錯誤，遍歷所有的欄位錯誤
                    for (const key in error.error) {
                        if (error.error.hasOwnProperty(key)) {
                            const fieldErrors = error.error[key];
                            if (Array.isArray(fieldErrors)) {
                                fieldErrors.forEach((err: string) => {
                                    messages.push(`${key}: ${err}`);
                                });
                            }
                        }
                    }
                } else {
                    // 其他類型的錯誤處理
                    messages.push(error.message || 'An unexpected error occurred.');
                }


                const dialogRef = this._gtsConfirmationService.open({
                    icon: { color: 'warn' },
                    title: this._translocoService.translate('messages'),
                    message: messages.join(' | '),
                    actions: { confirm: { label: 'Done', }, cancel: { show: false } }
                });

                dialogRef.afterClosed().subscribe(result => {
                    // 您沒有權限操作任何系統功能
                    if (result === 'confirmed' && errorCode === 'no-navigation-permission') {
                        location.reload();
                    }
                });
            }
        }
    }
}
