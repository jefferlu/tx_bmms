import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AppService } from 'app/app.service';


@Injectable({
    providedIn: 'root'
})
export class ProcessFunctionsService {

    constructor(private _appService: AppService) { }

    getBimGroup(): Observable<any> {
        return this._appService.get('forge/bim-group').pipe(
            tap((response: any) => { })
        );
    }

    getBimModelWithCategiries(): Observable<any> {
        return this._appService.get('forge/bim-models-with-categories').pipe(
            tap((response: any) => { })
        );
    }

    getData(request: any) {
        return this._appService.post('forge/bim-object', request).pipe(
            tap((res: any) => { })
        );
    }
}
