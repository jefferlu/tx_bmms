import { Injectable } from '@angular/core';
import { AppService } from 'app/app.service';
import { BehaviorSubject, Observable, shareReplay, tap } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class BimDataImportService {


    constructor(private _appService: AppService) { }

    getData(): Observable<any> {
        return this._appService.get('forge/objects');
    }

    bimDataImport(file: File): Observable<any> {
        const formData = new FormData();
        // formData.append('file', file, encodeURIComponent(file.name));
        formData.append('file', file, file.name);

        return this._appService.post('forge/bim-data-import', formData, { reportProgress: true, observe: 'events' }, false);
    }

    bimDataReload(filename: string): Observable<any> {
        return this._appService.post('forge/bim-data-reload', { filename: filename }, {}, false).pipe(
            tap((res: any) => { })
        )
    }

    delete(name: number): Observable<any> {
        return this._appService.delete('forge/objects', name).pipe(
            tap((res: any) => { })
        );
    }
}
