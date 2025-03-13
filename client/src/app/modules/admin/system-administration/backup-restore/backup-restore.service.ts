import { Injectable } from '@angular/core';
import { AppService } from 'app/app.service';
import { BehaviorSubject, Observable, tap } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class BackupRestoreService {

    private _data: BehaviorSubject<any> = new BehaviorSubject(null);

    constructor(private _appService: AppService) { }

    get data$(): Observable<any> {
        return this._data.asObservable();
    }

    getData(uri:string): Observable<any> {
        return this._appService.get(uri).pipe(
            tap((res: any) => {
                this._data.next(res);
            })
        );
    }
}
