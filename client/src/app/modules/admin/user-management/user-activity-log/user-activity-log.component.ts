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
import { MatMenuModule } from '@angular/material/menu';

@Component({
    selector: 'app-user-activity-log',
    templateUrl: './user-activity-log.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule, TranslocoModule, TableModule, DatePipe,
        MatIconModule, MatButtonModule, MatInputModule, MatMenuModule
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

    onSaveCsv() {
    }

    onSaveTxt() {
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
