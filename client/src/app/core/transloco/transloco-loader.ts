import { inject, Injectable } from "@angular/core";
import { Translation, TranslocoLoader } from "@jsverse/transloco";
import { HttpClient } from "@angular/common/http";

import { environment } from 'environments/environment';

const endpoint = environment.api;

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
    private http = inject(HttpClient);

    getTranslation(lang: string) {        
        return this.http.get<Translation>(`${endpoint}/core/translations?lang=${lang}`);
    }
}