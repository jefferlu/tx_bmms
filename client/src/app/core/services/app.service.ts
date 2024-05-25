import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, of, switchMap } from 'rxjs';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { environment } from 'environments/environment';


const endpoint = environment.host;

@Injectable({
    providedIn: 'root'
})
export class AppService {

    constructor(
        private _httpClient: HttpClient,
        private _fuseConfirmationService: FuseConfirmationService
    ) { }

    get(method: string, kwargs?: any, request?: any): Observable<any> {

        let queryString = '';
        for (let key in kwargs) {
            if (queryString === '')
                queryString = `?${key}=${kwargs[key]}`
            else
                queryString += `&${key}=${kwargs[key]}`

        }

        let url = `${endpoint}/api/${method}/${queryString}`;

        return this._httpClient.get(url, request).pipe(
            switchMap((response: any) => {
                return of(response);
            }),
            // catchError((e) => {

            //     console.log(e.error.detail ? e.error.detail : e.message)
            //     const dialogRef = this._fuseConfirmationService.open({
            //         // title: e.statusText,
            //         title: `API Error: get()`,
            //         message: e.error.detail ? e.error.detail : e.message,
            //         actions: { cancel: { show: false } }
            //     });

            //     // Return false
            //     return of(false)
            // })
        );
    }

    post(method: string, request: any): Observable<any> {

        return this._httpClient.post(`${endpoint}/api/${method}`, request).pipe(
            switchMap((response: any) => {
                return of(response);
            }),
            // catchError((e) => {
            //     console.log(e)
            //     console.log(e.error.detail ? e.error.detail : e.message)
            //     const dialogRef = this._fuseConfirmationService.open({
            //         // title: e.statusText,
            //         title: `API post() Error: ${method} `,
            //         message: e.error.detail ? e.error.detail : e.message,
            //         actions: { cancel: { show: false } }
            //     });

            //     // Return false
            //     return of(false)
            // })
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

        let url = `${endpoint}/api/${method}/${queryString}`;

        return this._httpClient.put(url, request).pipe(
            switchMap((response: any) => {
                return of(response);
            }),
            // catchError((e) => {
            //     console.log(e)
            //     console.log(e.error.detail ? e.error.detail : e.message)
            //     const dialogRef = this._fuseConfirmationService.open({
            //         // title: e.statusText,
            //         title: `API put() Error: ${method} `,
            //         message: e.error.detail ? e.error.detail : e.message,
            //         actions: { cancel: { show: false } }
            //     });

            //     // Return false
            //     return of(false)
            // })
        );
    }

    delete(method: string, pk: number): Observable<any> {
        let url = `${endpoint}/api/${method}/${pk}`;
        console.log('-->url', url)
        return this._httpClient.delete(url).pipe(
            switchMap((response: any) => {
                return of(response);
            })
        );
    }

}
