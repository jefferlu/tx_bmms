import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError, of, switchMap, throwError } from 'rxjs';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {

    const router = inject(Router);
    const authService = inject(AuthService);

    let newReq = req.clone();

    // 如果 `accessToken` 存在，則在標頭中加入 Authorization
    if (authService.accessToken) {

        req.headers.set('Authorization', 'Bearer ' + authService.accessToken)
        newReq = req.clone({
            setHeaders: {
                'Authorization': `Bearer ${authService.accessToken}`,
            }
        });
    }

    // Response
    return next(newReq).pipe(
        catchError((error: HttpErrorResponse) => {

            const errorCode = error.error?.code;
            // console.log(error.error)
            if (errorCode === 'token_not_valid') {

                const tokenClass = error.error.messages?.[0]?.token_class;

                // Access token is invalid
                if (tokenClass === 'AccessToken') {
                    return authService.signInUsingToken().pipe(
                        switchMap(() => {

                            // Reattempt the original request after refreshing token
                            const retryReq = req.clone({
                                setHeaders: {
                                    'Authorization': `Bearer ${authService.accessToken}`,
                                }
                            });
                            return next(retryReq);
                        }),
                        catchError(() => {
                            // If refresh token fails, navigate to sign-in
                            authService.signOut();
                            router.navigate(['/sign-in']);
                            return of(null);
                        })
                    );
                }
                // Refresh token is invalid
                else {
                    authService.signOut();
                    router.navigate(['/sign-in']);
                    return of(null);
                }
            }
            else if(errorCode === 'no-navigation-permission'){
                
                authService.signOut();
                return throwError(() => error);
            }

            // Throw the error so it can be handled by the original call
                 
            return throwError(() => error);
        }),
    );
};
