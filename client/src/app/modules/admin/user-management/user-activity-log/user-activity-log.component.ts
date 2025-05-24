import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule } from '@jsverse/transloco';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { Subject, takeUntil } from 'rxjs';
import { UserActivityLogService } from './user-activity-log.service';

@Component({
    selector: 'app-user-activity-log',
    templateUrl: './user-activity-log.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule, TranslocoModule, TableModule, DatePipe,
        MatIconModule, MatButtonModule, MatInputModule,
    ],
})
export class UserActivityLogComponent implements OnInit, OnDestroy {

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    data: any;
    first: number = 0;
    rowsPerPage: number = 100;

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _userActivityLogService: UserActivityLogService
    ) { }

    ngOnInit(): void {
        this._userActivityLogService.data$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((data: any) => {
                this.data = data;
                this._changeDetectorRef.markForCheck();
            });
    }

    loadPage(page?: number): void {
        // 更新 first
        this.first = (page - 1) * this.rowsPerPage;

        this._userActivityLogService.params = { 'page': page };
        this._userActivityLogService.getData()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((res: any) => { });


        // // 產生最終 request
        // this.request = {
        //     page,
        //     size: this.rowsPerPage,
        //     ...(regions.length > 0 && { regions }),
        //     ...(categories.length > 0 && { categories }),
        //     ...(this.keyword && { fuzzy_keyword: this.keyword }),
        // };

        // const cacheKey = JSON.stringify(this.request);
        // if (this._cache.has(cacheKey)) {

        //     this.objects = this._cache.get(cacheKey);
        //     this.updateCriteria();

        //     if (this.bimCriteria?.objects?.length > 0 && !this.bimCriteria.isRead) {
        //         this.selectedObjects = this.bimCriteria.objects;
        //         this.bimCriteria.isRead = true;
        //     }
        //     this._changeDetectorRef.markForCheck();
        //     return;
        // }

        // this.isLoading = true;
        // this._processFunctionsService.getData(this.request)
        //     .pipe(
        //         takeUntil(this._unsubscribeAll),
        //         finalize(() => {
        //             this.isLoading = false;
        //             this._changeDetectorRef.markForCheck();
        //         })
        //     )
        //     .subscribe({
        //         next: (res) => {

        //             if (res && res.count >= 0 && res.results) {
        //                 this.objects = { count: res.count, results: res.results };
        //                 this._cache.set(cacheKey, this.objects);
        //             } else {
        //                 this.objects = { count: 0, results: [] };
        //             }
        //             this.updateCriteria();

        //             // Set selectedObjects if bimCriteria has objects and they exist in this.objects.results
        //             // if (this.bimCriteria?.objects?.length > 0 && this.objects?.results?.length > 0) {
        //             // const validIds = new Set(this.objects.results.map((item: any) => item.id));
        //             // const validObjects = this.bimCriteria.objects.filter((obj: any) => validIds.has(obj.id));
        //             // if (this.selectedObjects.length > 0)
        //             //     this.selectedObjects = [this.selectedObjects, ...validObjects];
        //             // else
        //             //     this.selectedObjects = validObjects;
        //             // debugger;

        //             if (this.bimCriteria?.objects?.length > 0 && !this.bimCriteria.isRead) {
        //                 this.selectedObjects = this.bimCriteria.objects;
        //                 this.bimCriteria.isRead = true;
        //             }
        //             this._changeDetectorRef.markForCheck();
        //         },
        //         error: (err) => {
        //             console.error('Error:', err);
        //             this.objects = { count: 0, results: [] };
        //             this._changeDetectorRef.markForCheck();
        //         }
        //     });
    }

    onSearch(): void {
        this.search();
    }

    search(): void {

    }

    onPageChange(event: TableLazyLoadEvent): void {
        this.first = event.first || 0;
        this.rowsPerPage = event.rows || this.rowsPerPage;
        const page = this.first / this.rowsPerPage + 1;
        this.loadPage(page);
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
