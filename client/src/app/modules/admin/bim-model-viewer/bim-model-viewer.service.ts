import { Injectable } from '@angular/core';
import { AppService } from 'app/app.service';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class BimModelViewerService {

    constructor(private _appService: AppService) { }

    getData(slug?: any): Observable<any> {
        return this._appService.get('forge/bim-model', slug);
    }

    downloadCsv(fileName: string) {
        return this._appService.get('forge/bim-cobie-objects/download_csv',
            { file_name: encodeURIComponent(fileName) },
            { responseType: 'blob' }
        );
    }

    downloadBim(fileName: string, version: string = null) {
        const request: any = { file_name: encodeURIComponent(fileName) };
        if (version) request.version = version;
        return this._appService.get('forge/bim-original-file-download',
            request,
            { responseType: 'blob' }
        );
    }

    bimDataRevert(fileName: string, version: string = null) {
        const request: any = { file_name: encodeURIComponent(fileName) };
        if (version) request.version = version;
        return this._appService.post('forge/bim-data-revert', request);
    }
}
