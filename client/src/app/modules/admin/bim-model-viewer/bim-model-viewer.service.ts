import { inject, Injectable } from '@angular/core';
import { AppService } from 'app/app.service';
import { BehaviorSubject, map, Observable, take, tap } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class BimModelViewerService {

    private _list: BehaviorSubject<any[] | null> = new BehaviorSubject(null);
    private _detail: BehaviorSubject<any | null> = new BehaviorSubject(null);

    get bmmsList$(): Observable<any[]> {
        return this._list.asObservable();
    }

    get bmmsDetail$(): Observable<any> {
        return this._detail.asObservable();
    }

    private _appService = inject(AppService);

    getBmmsList(slug?: any): Observable<any> {
        return this._appService.get('bmms/list', slug).pipe(
            tap((response: any) => {
                this._list.next(response);
            })
        );
    }

    getBmmsDetail(id: string): Observable<any> {
        console.log('getBmmsDetail')
        return this._appService.get(`bmms/list/${id}`).pipe(
            tap((response: any) => {

            })
        );
    }

    getBmmsDetailById(id: string): Observable<any> {
        return this._list.pipe(
            take(1),
            map((list) => {
                const detail = list.find(item => item.id === +id) || null;
                this._detail.next(detail);
            })
        );
    }

}
