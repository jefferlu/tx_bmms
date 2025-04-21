import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AppService } from 'app/app.service';


@Injectable({
    providedIn: 'root'
})
export class ProcessFunctionsService {

    constructor(private _appService: AppService) { }

    getConditions(): Observable<any> {
        return this._appService.get('forge/bim-conditions').pipe(
            tap((response: any) => { })
        );
    }

    getData(request: any) {
        return this._appService.post('forge/bim-object', request).pipe(
            tap((res: any) => { })
        );
    }
}
