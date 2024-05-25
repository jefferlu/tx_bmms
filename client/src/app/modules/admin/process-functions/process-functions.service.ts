import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { InventoryPagination, InventoryProduct } from './process-functions.type';


@Injectable({
    providedIn: 'root'
})
export class ProcessFunctionsService {

    private _products: BehaviorSubject<InventoryProduct[] | null> = new BehaviorSubject(null);
    private _pagination: BehaviorSubject<InventoryPagination | null> = new BehaviorSubject(null);

    constructor(private _httpClient: HttpClient) { }

    get products$(): Observable<InventoryProduct[]> {
        return this._products.asObservable();
    }

    getProducts(page: number = 0, size: number = 30, sort: string = 'name', order: 'asc' | 'desc' | '' = 'asc', search: string = ''):
        Observable<{ pagination: InventoryPagination; products: InventoryProduct[] }> {
        return this._httpClient.get<{ pagination: InventoryPagination; products: InventoryProduct[] }>('api/apps/ecommerce/inventory/products', {
            params: {
                page: '' + page,
                size: '' + size,
                sort,
                order,
                search,
            },
        }).pipe(
            tap((response) => {
                this._pagination.next(response.pagination);
                this._products.next(response.products);
            }),
        );
    }
}
