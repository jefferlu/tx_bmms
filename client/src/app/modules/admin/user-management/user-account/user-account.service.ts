import { inject, Injectable } from '@angular/core';
import { AppService } from 'app/core/services/app.service';
import { BehaviorSubject, Observable, tap } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class UserAccountService {

    private _appService = inject(AppService);
    private _users: BehaviorSubject<any[] | null> = new BehaviorSubject(null);
    private _user: BehaviorSubject<any | null> = new BehaviorSubject(null);

    get users$(): Observable<any[]> {
        return this._users.asObservable();
    }

    get(id: number): Observable<any> {
        return this._appService.get(`users/${id}`).pipe(
            tap((res: any) => {
                this._user.next(res);
            })
        );
    }

    list(): Observable<any> {
        return this._appService.get('users').pipe(
            tap((res: any) => {
                this._users.next(res);
            })
        );
    }

    create(request: any): Observable<any> {
        return this._appService.post('users', request).pipe(
            tap((res: any) => {
                console.log(res)
                if (!res.error) {
                    const data = this._users.getValue();
                    const records = [...data, res];
                    this._users.next(records)
                }
            })
        )
    }

    update(request: any): Observable<any> {
        return this._appService.put(`users/${request.id}`, null, request).pipe(
            tap((res: any) => {
                if (!res.error) {
                    const data = this._users.getValue();
                    if (data) {
                        const records = data.map((user: any) =>
                            user.id === res.id ? { ...user, ...res } : user
                        );
                        this._users.next(records);
                    }
                }
            })
        )
    }

    delete(pk: number): Observable<any> {
        return this._appService.delete('users', pk).pipe(
            tap((res: any) => {
                const data = this._users.getValue();
                const records = data.filter(item => item.id !== pk);
                this._users.next(records);
            })
        );
    }

}
