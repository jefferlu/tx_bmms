import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone } from '@angular/core';
import { AppService } from 'app/core/services/app.service';
import { environment } from 'environments/environment';
import { BehaviorSubject, Observable, shareReplay, tap } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class BimDataImportService {

    private _files: any[] = [];
    private _objects: BehaviorSubject<any> = new BehaviorSubject(null);

    constructor(private _appService: AppService) { }

    get files(): any[] {
        return this._files;
    }

    set files(value: any) {
        this._files = value;
    }

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

    upload(file: File): Observable<any> {
        const formData = new FormData();
        formData.append('file', file, encodeURIComponent(file.name));

        return this._appService.post('forge/bim-data-import', formData, { reportProgress: true, observe: 'events' });
    }

    sse(fileid: string): Observable<any> {
        return this._appService.sse(`forge/events/${fileid}`).pipe(
            shareReplay(1),
            tap((res: any) => { })
        );
    }
}


