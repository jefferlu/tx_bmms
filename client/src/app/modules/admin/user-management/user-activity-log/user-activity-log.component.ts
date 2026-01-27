import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule, TranslocoService, TranslocoEvents } from '@jsverse/transloco';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { Subject, takeUntil, merge } from 'rxjs';
import { filter, map, distinctUntilChanged } from 'rxjs/operators';
import { UserActivityLogService } from './user-activity-log.service';
import { MatMenuModule } from '@angular/material/menu';
import { BreadcrumbService } from 'app/core/services/breadcrumb/breadcrumb.service';

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
    searchBinName: string = '';
    isLoading: boolean = false;

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _userActivityLogService: UserActivityLogService,
        private _translocoService: TranslocoService,
        private _breadcrumbService: BreadcrumbService
    ) { }

    ngOnInit(): void {
        // 初始化 breadcrumb
        this.updateBreadcrumb();

        // 同時監聽語系切換和翻譯文件加載完成事件
        // langChanges$: 當用戶切換語系時立即更新
        // translationLoadSuccess: 當翻譯文件首次加載完成時更新
        merge(
            this._translocoService.langChanges$,
            this._translocoService.events$.pipe(
                filter(e => e.type === 'translationLoadSuccess'),
                map(() => this._translocoService.getActiveLang())
            )
        ).pipe(
            distinctUntilChanged(),
            takeUntil(this._unsubscribeAll)
        ).subscribe(() => {
            this.updateBreadcrumb();
        });
