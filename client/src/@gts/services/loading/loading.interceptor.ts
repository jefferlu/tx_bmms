import { HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { GtsLoadingService } from '@gts/services/loading/loading.service';
import { finalize, Observable, take } from 'rxjs';

export const gtsLoadingInterceptor = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> =>
{
    const gtsLoadingService = inject(GtsLoadingService);
    let handleRequestsAutomatically = false;

    gtsLoadingService.auto$
        .pipe(take(1))
        .subscribe((value) =>
        {
            handleRequestsAutomatically = value;
        });

    // If the Auto mode is turned off, do nothing
    if ( !handleRequestsAutomatically )
    {
        return next(req);
    }

    // Set the loading status to true
    gtsLoadingService._setLoadingStatus(true, req.url);

    return next(req).pipe(
        finalize(() =>
        {
            // Set the status to false if there are any errors or the request is completed
            gtsLoadingService._setLoadingStatus(false, req.url);
        }));
};
