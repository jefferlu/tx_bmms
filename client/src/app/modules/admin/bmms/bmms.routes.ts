import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, Routes } from "@angular/router";

import { BmmsComponent } from "./bmms.component";
import { BmmsListComponent } from "./list/list.component";
import { BmmsDetailsComponent } from "./details/details.component";
import { BmmsService } from "./bmms.service";
import { inject } from "@angular/core";
import { catchError, of } from "rxjs";

const detailResolver = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const router = inject(Router);

    return inject(BmmsService).getBmmsDetailById(route.paramMap.get('id'))
        .pipe(
            catchError((error) => {
                // Log the error
                // console.error(error);

                // Get the parent url
                const parentUrl = state.url.split('/').slice(0, -1).join('/');

                // Navigate to there
                router.navigateByUrl(parentUrl);

                // Throw an error
                return of(error);
            }),
        );

}

export default [{
    path: '', component: BmmsComponent,
    // resolve: {},
    children: [{
        path: '',
        component: BmmsListComponent,
    }, {
        path: ':id',
        component: BmmsDetailsComponent,
        resolve: {
            detail: detailResolver
        }
    }]
}] as Routes;