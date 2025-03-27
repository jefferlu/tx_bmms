import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Table, TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ApsViewerComponent } from "../../../layout/common/aps-viewer/aps-viewer.component";
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { ProcessFunctionsService } from './process-functions.service';
import { finalize, Subject, takeUntil } from 'rxjs';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { MatDialog } from '@angular/material/dialog';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { NgClass } from '@angular/common';

@Component({
    selector: 'app-process-functions',
    templateUrl: './process-functions.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgClass,
        MatButtonModule, MatIconModule,
        MatMenuModule, MatDividerModule,
        TableModule, TranslocoModule, CdkScrollable
    ]
})
export class ProcessFunctionsComponent implements OnInit, OnDestroy {
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    @ViewChild('dataTable') dataTable: Table;

    data: any = { count: 0, results: [] };
    isLoading: boolean = false;
    criteria: any[];
    keyword: string;
    categories: any;
    selectedItems: any[] = [];
    rowsPerPage: number = 100; // 每頁顯示行數

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _translocoService: TranslocoService,
        private _matDialog: MatDialog,
        private _toastService: ToastService,
        private _processFunctionsService: ProcessFunctionsService
    ) { }

    ngOnInit(): void {
        this._processFunctionsService.criteria$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((criteria: any) => {
                this.criteria = criteria;
            });
    }

    onKeywordChange(event: Event) {
        const element = event.target as HTMLInputElement;
        this.keyword = element.value;
    }

    onSelected(item) {
        item.selected = !item.selected;
        const selectedItems = this.criteria
            .flatMap(item => item.bim_categories)
            .filter(bc => bc.selected)
            .map(bc => bc.value);
        this.categories = selectedItems;
    }

    onCollapse(criterion) {
        criterion.collapse = !criterion.collapse;
    }

    onSearch() {
        this.selectedItems = [];
        this.dataTable.reset(); // 重置分頁器到第一頁
        this.loadPage(1);
    }

    loadPage(page: number) {
        let request: any = {};
        if (this.keyword) request.value = this.keyword;
        if (Array.isArray(this.categories) && this.categories.length > 0) {
            request.category = this.categories.join(',');
        }
        request.page = page;
        request.size = this.rowsPerPage;

        if (!request.value && !request.category) {
            this.data = { count: 0, results: [] };
            this._changeDetectorRef.markForCheck();
            return;
        }

        this.isLoading = true;
        this._processFunctionsService.getData(request)
            .pipe(
                takeUntil(this._unsubscribeAll),
                finalize(() => {
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                })
            )
            .subscribe({
                next: (res) => {
                    if (res && res.count >= 0 && res.results) {
                        this.data.count = res.count; // 總筆數
                        this.data.results = res.results; // 當前頁資料
                        console.log('Loaded page:', page, 'Count:', this.data.count, 'Results length:', this.data.results.length);
                    } else {
                        this.data = { count: 0, results: [] };
                    }
                    this._changeDetectorRef.markForCheck();
                },
                error: (err) => {
                    console.error('Error:', err);
                    this.data = { count: 0, results: [] };
                    this._changeDetectorRef.markForCheck();
                }
            });
    }

    onPageChange(event: TableLazyLoadEvent) {
        const page = event.first / event.rows + 1; // 計算當前頁碼
        console.log('Lazy load triggered, first:', event.first, 'rows:', event.rows, 'page:', page);
        this.loadPage(page);
    }

    onRowSelect(event: any) {
        const item = event.data;
        if (!this.selectedItems.some(selected => this.isSameItem(selected, item))) {
            this.selectedItems.push(item);
        }
        console.log('Selected items:', this.selectedItems);
    }

    onRowUnselect(event: any) {
        const item = event.data;
        this.selectedItems = this.selectedItems.filter(selected => !this.isSameItem(selected, item));
        console.log('Selected items:', this.selectedItems);
    }

    private isSameItem(item1: any, item2: any): boolean {
        return item1.dbid === item2.dbid;
    }

    onClickAggregated(): void {
        if (!this.selectedItems || this.selectedItems.length === 0) {
            this._toastService.open({ message: `${this._translocoService.translate('select-at-least-one-model')}.` });
            return;
        }
        this.showAggregatedDialog();
    }

    showAggregatedDialog(): void {
        console.log(this.selectedItems);
        this._matDialog.open(ApsViewerComponent, {
            width: '99vw',
            height: '95vh',
            data: this.selectedItems
        });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}