import { Injectable } from '@angular/core';
import { AppService } from 'app/app.service';
import { BehaviorSubject, map, Observable, take, tap } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class BimModelViewerService {

    constructor(private _appService: AppService) { }

    getData(slug?: any): Observable<any> {
        return this._appService.get('forge/bim-model', slug);
    }
}
