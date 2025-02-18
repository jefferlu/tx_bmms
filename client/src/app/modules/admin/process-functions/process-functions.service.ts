import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { InventoryPagination, InventoryProduct } from './process-functions.type';
import { AppService } from 'app/app.service';


@Injectable({
    providedIn: 'root'
})
export class ProcessFunctionsService {

    private _criteria: BehaviorSubject<InventoryProduct[] | null> = new BehaviorSubject(null);

    constructor(private _appService: AppService) { }

    get criteria$(): Observable<any> {
        return this._criteria.asObservable();
    }

    getCriteria(): Observable<any> {
        return this._appService.get('forge/bim-group').pipe(
            tap((response: any) => {
                this._criteria.next(response);
            })
        );
    }

}
