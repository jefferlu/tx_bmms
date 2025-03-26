import { Injectable } from '@angular/core';
import { AppService } from 'app/app.service';
import { BehaviorSubject, map, Observable, take, tap } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class BimModelViewerService {

    // private _data: BehaviorSubject<any[] | null> = new BehaviorSubject(null);

    constructor(private _appService: AppService) { }

    // get data$(): Observable<any[]> {
    //     return this._data.asObservable();
    // }

    getData(slug?: any): Observable<any> {
        return this._appService.get('forge/bim-model', slug);
    }
}
