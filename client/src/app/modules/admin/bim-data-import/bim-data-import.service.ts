import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone } from '@angular/core';
import { AppService } from 'app/app.service';
import { environment } from 'environments/environment';
import { BehaviorSubject, Observable, shareReplay, tap } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class BimDataImportService {

    private _objects: BehaviorSubject<any> = new BehaviorSubject(null);

    constructor(private _appService: AppService) { }

    get objects$(): Observable<any> {
        return this._objects.asObservable();
    }

    getObjects(): Observable<any> {
        return this._appService.get('forge/objects').pipe(
            tap((res: any) => {
                this._objects.next(res);
            })
        );
    }

    bimDataInport(file: File): Observable<any> {
        const formData = new FormData();
        formData.append('file', file, encodeURIComponent(file.name));

        return this._appService.post('forge/bim-data-import', formData, { reportProgress: true, observe: 'events' });
    }

    delete(name: number): Observable<any> {
        return this._appService.delete('forge/objects', name).pipe(
            tap((res: any) => { })
        );
    }
}
