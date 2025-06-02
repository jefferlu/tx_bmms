import { Injectable } from '@angular/core';
import { AppService } from 'app/app.service';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class LanguagesService {

    constructor(private _appService: AppService) { }

    download(): Observable<any> {
        return this._appService.get('core/translations/download_excel', {},
            { responseType: 'blob' }
        );
    }

    upload(file: File): Observable<any> {
        const formData = new FormData();
        formData.append('file', file, file.name);
        return this._appService.post('core/translations/upload_excel', formData);
    }


}
