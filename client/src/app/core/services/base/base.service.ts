import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, forkJoin, Observable, tap } from 'rxjs';
import { AppService } from 'app/app.service';

@Injectable({
    providedIn: 'root'
})
export class BaseService {

    private _data: BehaviorSubject<any> = new BehaviorSubject(null);
    private _tree: BehaviorSubject<any> = new BehaviorSubject(null);
    private _table: BehaviorSubject<any> = new BehaviorSubject(null);

    private _params: any;
    private _from: any;

    protected _appService = inject(AppService);

    constructor(private uri: string) { }

    get data$(): Observable<any> {
        return this._data.asObservable();
    }

    get tree$(): Observable<any> {
        return this._tree.asObservable();
    }

    get table$(): Observable<any> {
        return this._table.asObservable();
    }

    get hasData(): boolean {
        return this._data.value !== null;
    }

    get params(): any {
        return this._params;
    }

    set params(value: any) {
        this._params = value;
    }

    get form(): any {
        return this._from;
    }

    set form(value: any) {
        this._from = value;
    }

    getData(): Observable<any> {
        return this._appService.get(this.uri,this._params).pipe(
            tap((res: any) => {
                this._data.next(res);
            })
        );
    }

    getTree(): Observable<any> {
        return this._appService.get(`${this.uri}-trees`).pipe(
            tap((res: any) => {
                this._tree.next(res);
            })
        );
    }

    getTable(): Observable<any> {
        return this._appService.get(`${this.uri}-tables`).pipe(
            tap((res: any) => {
                this._table.next(res);
            })
        );
    }

    create(request: any): Observable<any> {
        return this._appService.post(this.uri, request).pipe(
            tap((res: any) => {
                const data = this._data.getValue();
                if (data) {
                    const updateData = [...data, res];
                    this._data.next(updateData);
                }
            })
        )
    }

    update(request: any): Observable<any> {
        return this._appService.put(`${this.uri}/${request.id}`, null, request).pipe(
            tap((res: any) => {
                let data = this._data.getValue();
                if (data) {
                    const updateData = data.map((item: any) =>
                        item.id === res.id ? { ...item, ...res } : item
                    );

                    this._data.next(updateData);
                }
            })
        )
    }

    delete(pk: number): Observable<any> {
        return this._appService.delete(this.uri, pk).pipe(
            tap((res: any) => {
                const data = this._data.getValue();
                if (data) {
                    const updateData = data.filter(item => item.id !== pk);
                    this._data.next(updateData);
                }
            })
        );
    }

    reloadData(): Observable<any> {
        return forkJoin({
            tree: this.getTree(),
            table: this.getTable()
        }).pipe(
            tap((res: any) => {
                this._tree.next(res.tree);
                this._table.next(res.table);
            })
        );
    }

    findItemById(data: any[], id: number): any {
        for (const item of data) {

            if (item.id === id) {
                return item;
            }
            if (item.children) {
                const found = this.findItemById(item.children, id);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }
}
