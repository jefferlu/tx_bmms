import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AppService } from 'app/app.service';


@Injectable({
    providedIn: 'root'
})
export class ProcessFunctionsService {

    constructor(private _appService: AppService) { }

    getRegions(): Observable<any> {
        return this._appService.get('forge/bim-regions').pipe(
            tap((response: any) => { })
        );
    }

    getConditions(): Observable<any> {
        return this._appService.get('forge/bim-conditions').pipe(
            tap((response: any) => { })
        );
    }

    getCriteria(): Observable<any> {
        return this._appService.get('forge/user-criteria').pipe(
            tap((response: any) => { })
        );
    }

    updateCriteria(bimCriteria): Observable<any> {
        return this._appService.put('forge/user-criteria', '', bimCriteria).pipe(
            tap((response: any) => { })
        );
    }

    getData(request: any) {
        return this._appService.post('forge/bim-object', request).pipe(
            tap((res: any) => { })
        );
    }

    getSuggestions(): Observable<any> {
        return this._appService.get('forge/bim-cobie-objects/distinct_name_value').pipe(
            tap((response: any) => { })
        );
    }
}
