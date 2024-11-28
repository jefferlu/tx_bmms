import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

import { catchError, Observable, of, switchMap, throwError } from 'rxjs';

import { UserService } from 'app/core/user/user.service';
import { CookieOptions, CookieService } from 'ngx-cookie-service';
import { ApsCredentialsService } from '../services/aps-credentials/aps-credentials.service';
import { Router } from '@angular/router';
import { AppService } from '../services/app.service';


@Injectable({ providedIn: 'root' })
export class AuthService {
    private _accessToken: string | null = null;
    private _authenticated: boolean = false;

    private _router = inject(Router);
    private _httpClient = inject(HttpClient);
    private _cookieService = inject(CookieService)
    private _appService = inject(AppService);
    private _userService = inject(UserService);

    get accessToken(): string {
        return this._accessToken;
    }

    set refreshToken(refresh: string) {
        let options: CookieOptions = { expires: 30, path: '/', secure: true }
        this._cookieService.set('bmms-refresh-token', refresh, options);
    }

    get refreshToken(): string {
        return this._cookieService.get('bmms-refresh-token');
    }
    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Forgot password
     *
     * @param email
     */
    forgotPassword(email: string): Observable<any> {
        return this._httpClient.post('api/auth/forgot-password', email);
    }

    /**
     * Reset password
     *
     * @param password
     */
    resetPassword(password: string): Observable<any> {
        return this._appService.post(`reset-password`, { "password": password }).pipe(
            switchMap((response: any) => {
                return of(response);
            })
        );
    }

    /**
     * Sign in
     *
     * @param credentials
     */
    signIn(credentials: { email: string; password: string }): Observable<any> {
        // Throw error, if the user is already logged in
        if (this._authenticated) {
            return throwError(() => 'User is already logged in.')  // Detail error message
            // return throwError('User is already logged in.');
        }

        return this._appService.post(`core/login`, credentials).pipe(
            switchMap((response: any) => {
                // Store the access token in the local storage

                this._accessToken = response.access;
                this.refreshToken = response.refresh;

                // Set the authenticated flag to true
                this._authenticated = true;

                // Store the user on the user service
                this._userService.user = response.user;

                // Return a new observable with the response
                return of(response);
            }),
            catchError((error) => {
                // Log the error here to see if it's getting caught
                console.error('Error in signIn method:', error);
                return throwError(() => error);
            })
        );
    }

    /**
     * Sign in using the access token
     */
    signInUsingToken(): Observable<any> {

        // Sign in using the token                
        return this._appService.post(`core/refresh-token`, { refresh: this.refreshToken }).pipe(
            switchMap((response: any) => {

                this._accessToken = response.access;
                this.refreshToken = response.refresh;


                // Set the authenticated flag to true
                this._authenticated = true;

                // Store the user on the user service
                this._userService.user = response.user;

                // Return true
                return of(true);
            }),
            catchError((error) => {

                this.signOut();
                this._router.navigate(['/sign-in']);
                // return throwError(() => error)
                return of(false)
            })
        );
    }


    /**
     * Sign out
     */
    signOut(): Observable<any> {
        // Remove all from the local cookie
        this._accessToken = null;
        this._cookieService.deleteAll('/');

        // Set the authenticated flag to false
        this._authenticated = false;

        // Return the observable
        return of(true);
    }

    /**
     * Check the authentication status
     */
    check(): Observable<boolean> {

        // Check if the user is logged in
        if (this._authenticated) {
            return of(true);
        }

        // If the refresh token exists, and it didn't expire, sign in using it
        if (this.refreshToken) {
            return this.signInUsingToken();
        }

        return of(false)
    }
}
