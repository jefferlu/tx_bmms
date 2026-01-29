import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { MenuItem } from 'primeng/api';

export interface BreadcrumbConfig {
    items: MenuItem[];
    home?: MenuItem;
}

@Injectable({
    providedIn: 'root'
})
export class BreadcrumbService {
    private _breadcrumbSubject = new BehaviorSubject<BreadcrumbConfig>({
        items: [],
        home: { icon: 'pi pi-home', routerLink: '/' }
    });

    breadcrumb$: Observable<BreadcrumbConfig> = this._breadcrumbSubject.asObservable();

    constructor() { }

    setBreadcrumb(items: MenuItem[], home?: MenuItem): void {
        this._breadcrumbSubject.next({
            items,
            home: home || { icon: 'pi pi-home', routerLink: '/' }
        });
    }

    clear(): void {
        this._breadcrumbSubject.next({
            items: [],
            home: { icon: 'pi pi-home', routerLink: '/' }
        });
    }
}
