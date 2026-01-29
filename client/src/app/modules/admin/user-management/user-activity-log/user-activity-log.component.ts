import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { Subject, takeUntil } from 'rxjs';
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

        // 監聽語系變化以更新 breadcrumb
        this._translocoService.langChanges$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => {
                this.updateBreadcrumb();
            });

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

        const params: any = { page };

        // 保留搜索參數
        if (this.searchBinName && this.searchBinName.trim()) {
            params.search = this.searchBinName.trim();
        }

        this._userActivityLogService.params = params;
        this._userActivityLogService.getData()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((res: any) => { });
    }

    onSearch(): void {
        this.search();
    }

    search(): void {
        this.first = 0; // 重置到第一頁
        const params: any = { page: 1 };

        if (this.searchBinName && this.searchBinName.trim()) {
            params.search = this.searchBinName.trim();
        }

        this.isLoading = true;
        this._userActivityLogService.params = params;
        this._userActivityLogService.getData()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: () => {
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                },
                error: () => {
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                }
            });
    }

    onPageChange(event: TableLazyLoadEvent): void {
        this.first = event.first || 0;
        this.rowsPerPage = event.rows || this.rowsPerPage;
        const page = this.first / this.rowsPerPage + 1;
        this.loadPage(page);
    }

    onSaveCsv(): void {
        // 使用 TranslocoService 獲取標題（支持多語系）
        const headers = [
            this._translocoService.translate('account'),
            this._translocoService.translate('name'),
            this._translocoService.translate('function-name'),
            this._translocoService.translate('action'),
            this._translocoService.translate('status'),
            this._translocoService.translate('timestamp'),
            this._translocoService.translate('ip-address')
        ];

        const searchParams: any = {};
        if (this.searchBinName && this.searchBinName.trim()) {
            searchParams.search = this.searchBinName.trim();
        }

        this.isLoading = true;
        this._userActivityLogService.exportData('csv', headers, searchParams)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (blob: Blob) => {
                    const link = document.createElement('a');
                    const url = URL.createObjectURL(blob);
                    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                    link.setAttribute('href', url);
                    link.setAttribute('download', `user_activity_log_${timestamp}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                },
                error: () => {
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                }
            });
    }

    onSaveTxt(): void {
        // 使用 TranslocoService 獲取標題（支持多語系）
        const headers = [
            this._translocoService.translate('account'),
            this._translocoService.translate('name'),
            this._translocoService.translate('function-name'),
            this._translocoService.translate('action'),
            this._translocoService.translate('status'),
            this._translocoService.translate('timestamp'),
            this._translocoService.translate('ip-address')
        ];

        const searchParams: any = {};
        if (this.searchBinName && this.searchBinName.trim()) {
            searchParams.search = this.searchBinName.trim();
        }

        this.isLoading = true;
        this._userActivityLogService.exportData('txt', headers, searchParams)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (blob: Blob) => {
                    const link = document.createElement('a');
                    const url = URL.createObjectURL(blob);
                    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                    link.setAttribute('href', url);
                    link.setAttribute('download', `user_activity_log_${timestamp}.txt`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                },
                error: () => {
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                }
            });
    }

    // 更新 breadcrumb
    private updateBreadcrumb(): void {
        this._breadcrumbService.setBreadcrumb([
            {
                label: this._translocoService.translate('user-management')
            },
            {
                label: this._translocoService.translate('user-activity-log')
            }
        ]);
    }

    ngOnDestroy(): void {
        this._breadcrumbService.clear();
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
