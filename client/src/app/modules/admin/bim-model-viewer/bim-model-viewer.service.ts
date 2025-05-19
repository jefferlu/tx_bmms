import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AppService } from 'app/app.service';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class BimModelViewerService {

    constructor(
        private http: HttpClient,
        private _appService: AppService) { }

    getData(slug?: any): Observable<any> {
        return this._appService.get('forge/bim-model', slug);
    }

    downloadCsv(fileName: string) {
        return this._appService.get('forge/bim-cobie-objects',
            { file_name: encodeURIComponent(fileName) },
            { responseType: 'blob' }
        );
    }
}
