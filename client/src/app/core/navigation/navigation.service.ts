import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AppService } from 'app/app.service';
import { Navigation } from 'app/core/navigation/navigation.types';
import { Observable, ReplaySubject, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NavigationService {
    private _appService = inject(AppService);
    private _navigation: ReplaySubject<Navigation> = new ReplaySubject<Navigation>(1);

    /**
     * Constructor
     */
    constructor(private _httpClient: HttpClient) {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for navigation
     */
    get navigation$(): Observable<Navigation> {
        return this._navigation.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Get all navigation data
     */
    // get(): Observable<Navigation> {
    //     return this._httpClient.get<Navigation>('api/common/navigation').pipe(
    //         tap((navigation) => {
    //             console.log('--->',navigation)
    //             this._navigation.next(navigation);
    //         }),
    //     );
    // }

    get(): Observable<Navigation> {
        return this._appService.get('core/navigations').pipe(
            tap((navigation: any) => {
                this._navigation.next(navigation);
            })
        );
    }
}
