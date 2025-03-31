import { Injectable } from '@angular/core';
import { AppService } from 'app/app.service';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class BimManagementService {

    constructor(private _appService: AppService) { }

    getData(slug?: any): Observable<any> {
        return this._appService.get('forge/bim-model', slug);
    }

    bimReprocessData(request = {}): Observable<any> {
        return this._appService.post('forge/bim-update-categories', request);
    }
}
