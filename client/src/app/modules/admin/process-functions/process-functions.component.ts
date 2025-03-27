import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { ApsViewerComponent } from "../../../layout/common/aps-viewer/aps-viewer.component";
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { ProcessFunctionsService } from './process-functions.service';
import { debounceTime, finalize, Subject, takeUntil } from 'rxjs';
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
        TableModule, SkeletonModule,
        TranslocoModule, CdkScrollable
    ]
})
export class ProcessFunctionsComponent implements OnInit, OnDestroy {
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    private lazyLoadSubject = new Subject<TableLazyLoadEvent>();
    private loadedPages: Set<number> = new Set(); // 記錄已載入的分頁

    @ViewChild('dataTable') dataTable: Table;

    data: any = { count: 0, results: [] };
    isLoading: boolean = false;
    criteria: any[];
    keyword: string;
    categories: any;
    selectedItems: any[] = [];
    rowsPerPage: number = 100; // 固定每頁大小

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

        this.lazyLoadSubject.pipe(
            debounceTime(500),
            takeUntil(this._unsubscribeAll)
        ).subscribe(event => {
            this.loadBimObjects(event);
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
        this.loadedPages.clear();
        this.loadInitialData();
    }

    private loadInitialData() {
        let request: any = {};
        if (this.keyword) request.value = this.keyword;
        if (Array.isArray(this.categories) && this.categories.length > 0) {
            request.category = this.categories.join(',');
        }
        request.page = 1;
        request.size = this.rowsPerPage;

        if (!request.value && !request.category) {
            this.data = { count: 0, results: [] };
            this.resetTableScroll();
            this._changeDetectorRef.markForCheck();
            return;
        }

        this.isLoading = true;
        this._processFunctionsService.getData(request)
            .pipe(
                takeUntil(this._unsubscribeAll),
                finalize(() => {
                    this.isLoading = false;
                    this.resetTableScroll();
                    this._changeDetectorRef.markForCheck();
                })
            )
            .subscribe({
                next: (res) => {
                    if (res && res.count > 0 && res.results && res.results.length > 0) {
                        this.data.count = res.count ?? 0;
                        this.data.results = Array(this.data.count);
                        this.data.results.splice(0, res.results.length, ...res.results);
                        this.loadedPages.add(1);
                    } else {
                        this.data = { count: 0, results: [] };
                    }
                },
                error: (err) => {
                    console.error('Error:', err);
                    this.data = { count: 0, results: [] };
                    this.resetTableScroll();
                }
            });
    }

    loadBimObjects(event: TableLazyLoadEvent) {
        if (!event.first || !event.rows || this.isLoading) {
            this._changeDetectorRef.detectChanges(); // 強制更新，避免卡住
            return;
        }

        const rowsPerPage = event.rows;
        const rowHeight = 46;
        const scrollHeight = 600;
        const visibleRows = Math.ceil(scrollHeight / rowHeight);
        const pagesToLoad = Math.ceil(visibleRows / rowsPerPage) + 1;

        const currentFirst = event.first;
        const currentPage = Math.floor(currentFirst / rowsPerPage) + 1;

        // 檢查是否需要載入資料
        const endIndex = currentFirst + (rowsPerPage * pagesToLoad);
        const needsLoading = Array.from(
            { length: pagesToLoad },
            (_, i) => currentPage + i
        ).some(page => !this.loadedPages.has(page));

        if (!needsLoading) {
            console.log(`Pages ${currentPage} to ${currentPage + pagesToLoad - 1} already loaded, skipping`);
            this.isLoading = false; // 明確設為 false
            this._changeDetectorRef.detectChanges(); // 強制更新，避免卡住
            return;
        }

        let request: any = {};
        if (this.keyword) request.value = this.keyword;
        if (Array.isArray(this.categories) && this.categories.length > 0) {
            request.category = this.categories.join(',');
        }
        request.page = currentPage;
        request.size = rowsPerPage * pagesToLoad;

        if (!request.value && !request.category) {
            this.data = { count: 0, results: [] };
            this.isLoading = false;
            event.forceUpdate();
            // this._changeDetectorRef.detectChanges();
            return;
        }

        this.isLoading = true;
        this._processFunctionsService.getData(request)
            .pipe(
                takeUntil(this._unsubscribeAll),
                finalize(() => {
                    this.isLoading = false;
                    this.restoreSelection();
                    event.forceUpdate();
                    this._changeDetectorRef.markForCheck(); // 強制更新
                    console.log('forceUpdated()')
                })
            )
            .subscribe({
                next: (res) => {
                    if (res && res.results && res.results.length > 0) {
                        this.data.count = res.count ?? 0;
                        this.data.results.splice(currentFirst, res.results.length, ...res.results);
                        for (let i = 0; i < pagesToLoad; i++) {
                            this.loadedPages.add(currentPage + i);
                        }
                    }
                },
                error: (err) => {
                    console.error('Error:', err);
                }
            });
    }

    private restoreSelection() {
        this.data.results.forEach(item => {
            if (item) {
                const selectedItem = this.selectedItems.find(selected => this.isSameItem(selected, item));
                if (selectedItem) {
                    item.selected = true;
                }
            }
        });
    }

    private isSameItem(item1: any, item2: any): boolean {
        return item1.dbid === item2.dbid;
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

    private resetTableScroll() {
        if (this.dataTable) {
            this.dataTable.scrollToVirtualIndex(0);
            this.dataTable.first = 0;
        }
    }
}