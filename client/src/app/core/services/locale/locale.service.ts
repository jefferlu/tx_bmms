import { Injectable } from '@angular/core';
import { AppService } from 'app/app.service';
import { BehaviorSubject, Observable, tap } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class LocaleService {

    private _data: BehaviorSubject<any> = new BehaviorSubject(null);

    constructor(private _appService: AppService) { }

    getData(): Observable<any> {
        return this._appService.get('core/locales').pipe(
            tap((res: any) => {
                this._data.next(res);
            })
        );
    }
}
