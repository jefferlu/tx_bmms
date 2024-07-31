import { inject, Injectable } from '@angular/core';
import { UserService } from 'app/core/user/user.service';
import { environment } from 'environments/environment';

const LANGUAGE_KEY: string = environment.language_key;

@Injectable({
    providedIn: 'root'
})
export class LocalStorageService {

    private _userService = inject(UserService);

    set language(lang: string) {
        let languages = JSON.parse(localStorage.getItem(LANGUAGE_KEY) || '{}');

        languages[this._userService.user.email] = lang;
        localStorage.setItem(LANGUAGE_KEY, JSON.stringify(languages));
    }

    get language(): string {
        let languages = JSON.parse(localStorage.getItem(LANGUAGE_KEY) || '{}');
        if (this._userService.user)
            return languages[this._userService.user.email];
        else
            return null;
    }
}
