import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, NgZone } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';

import { environment } from 'environments/environment';
import { BehaviorSubject, catchError, firstValueFrom, Observable, Observer, of, switchMap, tap, throwError } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { GtsConfirmationService } from '@gts/services/confirmation';

const endpoint = environment.api;

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
        if (params) {
            const queryParams = [];
            for (let key in params) {
                // 對每個參數的值進行 URL 編碼
                const encodedValue = encodeURIComponent(params[key]);
                queryParams.push(`${key}=${encodedValue}`);
            }
            // 將所有參數用 & 連接，並在開頭添加 ?
            queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        }

        let url = `${endpoint}/${method}/${queryString}`;
        // console.log(url); // 檢查生成的 URL
        return this._httpClient.get(url, request).pipe(
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

    post(method: string, request: any, options = {}, showDialog = true): Observable<any> {

        return this._httpClient.post(`${endpoint}/${method}`, request, options).pipe(
            switchMap((res: any) => {
                return of(res);
            }),
            catchError((e) => {

                console.log(e);
                if (showDialog)
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
        // HTTP 401 由登入頁面處理
        if (error.status === 401) {
            return;
        }

        const messages: string[] = [];
        const errorCode = error.error?.code;

        if (error.error instanceof ErrorEvent) {
            // 用戶端網路相關錯誤
            messages.push(`An error occurred: ${error.error.message}`);
        } else {
            // 處理後端定義的錯誤碼並轉換為多語系訊息
            if (errorCode) {
                messages.push(this._translocoService.translate(errorCode));
            }
            // 處理 error.error 為物件且包含 error 欄位的情況
            else if (error.error?.error && typeof error.error.error === 'string') {
                messages.push(error.error.error);
            }
            // 處理 HTTP 400 驗證錯誤
            else if (error.status === 400 && error.error && typeof error.error === 'object') {
                for (const key in error.error) {
                    if (error.error.hasOwnProperty(key)) {
                        const fieldErrors = error.error[key];
                        if (Array.isArray(fieldErrors)) {
                            fieldErrors.forEach((err: string) => {
                                messages.push(`${key}: ${err}`);
                            });
                        } else if (typeof fieldErrors === 'string') {
                            messages.push(`${key}: ${fieldErrors}`);
                        }
                    }
                }
            }
            // 其他未知錯誤
            else {
                messages.push(error.message || 'An unexpected error occurred.');
            }
        }

        // 如果沒有錯誤訊息，設置預設訊息
        if (messages.length === 0) {
            messages.push('An unexpected error occurred.');
        }

        // 顯示錯誤對話框
        const dialogRef = this._gtsConfirmationService.open({
            icon: { color: 'warn' },
            title: this._translocoService.translate('messages'),
            message: messages.join(' | '),
            actions: { confirm: { label: 'Done' }, cancel: { show: false } }
        });

        // 處理特定錯誤碼的後續操作
        dialogRef.afterClosed().subscribe(result => {
            if (result === 'confirmed' && errorCode === 'no-navigation-permission') {
                location.reload();
            }
        });
    }

    // 暫時使用OSS, 需取得token
    getToken(): Observable<any> {
        return this.get('forge/auth').pipe(
            switchMap((res: any) => {
                return of(res);
            })
        );
    }
}
