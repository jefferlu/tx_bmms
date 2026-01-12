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
        private _translocoService: TranslocoService
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
        const searchParams: any = {};
        if (this.searchBinName && this.searchBinName.trim()) {
            searchParams.search = this.searchBinName.trim();
        }

        this.isLoading = true;
        this._userActivityLogService.getAllData(searchParams)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (response: any) => {
                    const data = response?.results || [];
                    if (data.length === 0) {
                        this.isLoading = false;
                        this._changeDetectorRef.markForCheck();
                        return;
                    }

                    // 準備 CSV 標題（使用多語系）
                    const headers = [
                        this._translocoService.translate('account'),
                        this._translocoService.translate('name'),
                        this._translocoService.translate('function-name'),
                        this._translocoService.translate('action'),
                        this._translocoService.translate('status'),
                        this._translocoService.translate('timestamp'),
                        this._translocoService.translate('ip-address')
                    ];
                    const csvContent = [
                        headers.join(','),
                        ...data.map((item: any) => {
                            const timestamp = new Date(item.timestamp).toLocaleString('zh-TW', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                            });
                            return [
                                this.escapeCsvValue(item.email || ''),
                                this.escapeCsvValue(item.username || ''),
                                this.escapeCsvValue(item.function || ''),
                                this.escapeCsvValue(item.action || ''),
                                this.escapeCsvValue(item.status || ''),
                                this.escapeCsvValue(timestamp),
                                this.escapeCsvValue(item.ip_address || '')
                            ].join(',');
                        })
                    ].join('\n');

                    // 添加 BOM 以支持 Excel 正確顯示中文
                    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    const url = URL.createObjectURL(blob);
                    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                    link.setAttribute('href', url);
                    link.setAttribute('download', `user_activity_log_${timestamp}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

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
        const searchParams: any = {};
        if (this.searchBinName && this.searchBinName.trim()) {
            searchParams.search = this.searchBinName.trim();
        }

        this.isLoading = true;
        this._userActivityLogService.getAllData(searchParams)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (response: any) => {
                    const data = response?.results || [];
                    if (data.length === 0) {
                        this.isLoading = false;
                        this._changeDetectorRef.markForCheck();
                        return;
                    }

                    // 準備 TXT 內容（Tab 分隔格式，使用多語系）
                    const headers = [
                        this._translocoService.translate('account'),
                        this._translocoService.translate('name'),
                        this._translocoService.translate('function-name'),
                        this._translocoService.translate('action'),
                        this._translocoService.translate('status'),
                        this._translocoService.translate('timestamp'),
                        this._translocoService.translate('ip-address')
                    ];
                    const txtContent = [
                        headers.join('\t'),
                        ...data.map((item: any) => {
                            const timestamp = new Date(item.timestamp).toLocaleString('zh-TW', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                            });
                            return [
                                item.email || '',
                                item.username || '',
                                item.function || '',
                                item.action || '',
                                item.status || '',
                                timestamp,
                                item.ip_address || ''
                            ].join('\t');
                        })
                    ].join('\n');

                    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
                    const link = document.createElement('a');
                    const url = URL.createObjectURL(blob);
                    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                    link.setAttribute('href', url);
                    link.setAttribute('download', `user_activity_log_${timestamp}.txt`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                },
                error: () => {
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                }
            });
    }

    private escapeCsvValue(value: string): string {
        if (value === null || value === undefined) {
            return '';
        }
        const stringValue = String(value);
        // 如果包含逗號、引號或換行符，需要用雙引號包裹，並將內部的雙引號轉義
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
