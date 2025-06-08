import { Injectable } from '@angular/core';
import { AppService } from 'app/app.service';

@Injectable({
    providedIn: 'root'
})
export class ApsViewerService {

    constructor(private _appService: AppService) { }

    downloadCsv(fileName: string) {
        return this._appService.get('forge/bim-cobie-objects',
            { file_name: encodeURIComponent(fileName) },
            { responseType: 'blob' }
        );
    }

    downloadSqlite(fileName: string, version: string = null) {
        const request: any = { file_name: encodeURIComponent(fileName) };
        if (version) request.version = version;
        return this._appService.get('forge/bim-sqlite-download',
            request,
            { responseType: 'blob' }
        );
    }

    getDbids(modelName: string, value: string) {
        const request: any = { model_name: encodeURIComponent(modelName), value: value };
        return this._appService.get('forge/bim-dbid-objects', request);
    }
}
