import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { NgClass } from '@angular/common';
import { CdkScrollable } from '@angular/cdk/scrolling';

import { finalize, Subject, takeUntil } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';

import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Table, TableModule, TableLazyLoadEvent } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';

import { ToastService } from 'app/layout/common/toast/toast.service';
import { ApsViewerComponent } from "../../../layout/common/aps-viewer/aps-viewer.component";
import { ProcessFunctionsService } from './process-functions.service';
import { FormsModule } from '@angular/forms';



@Component({
    selector: 'app-process-functions',
    templateUrl: './process-functions.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgClass, CdkScrollable, FormsModule,
        MatButtonModule, MatIconModule,
        MatMenuModule, MatDividerModule,
        TableModule, TranslocoModule,
        SelectModule, MultiSelectModule
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

    // 用於選擇tender和name
    selectedTender: string;
    selectedNames: string[] = [];

    // 用於過濾選項
    tenderOptions = [];
    nameOptions = [];

    data1 = [
        { "id": 38, "tender": "T3-TP01", "name": "T3-TP01-TX1-XX-XXX-M3-SE-00001-7002.nwc" },
        { "id": 39, "tender": "T3-TP01", "name": "T3-TP01-XXX-XX-XXX-M3-XX-00001.nwd" },
        { "id": 36, "tender": "T3-TP16", "name": "T3-TP16-XXX-XX-XXX-M3-XX-00001.nwd" },
        { "id": 40, "tender": "T3-TP21A", "name": "T3-TP21A-XXX-XX-XXX-M3-XX-00001.nwd" },
        { "id": 37, "tender": "T3-TP25", "name": "T3-TP25-XXX-XX-XXX-M3-XX-00001.nwd" }
    ];

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
        this.tenderOptions = [...new Set(this.data1.map(item => item.tender))];

        // 預設選擇第一個tender
        if (this.tenderOptions.length > 0) {
            this.selectedTender = this.tenderOptions[0];  // 設定為第一個tender
            this.onTenderChange(this.selectedTender);      // 更新name選項
        }
    }

    // 當選擇tender時，更新name選項
    onTenderChange(tender: string) {
        console.log('onTenderChange')
        // 根據選擇的tender過濾對應的name選項
        this.nameOptions = this.data1.filter(item => item.tender === this.selectedTender).map(item => item.name);
        // 重設選擇的name
        console.log(this.data1, this.selectedTender, this.nameOptions)
        this.selectedNames = [];
    }

    onKeywordChange(event: Event) {
        const element = event.target as HTMLInputElement;
        this.keyword = element.value;
    }

    onSelected(item) {
        console.log(item)
        item.selected = !item.selected;
        const selectedItems = this.criteria
            .flatMap(item =>
                item.bim_categories.map(bc => ({
                    bim_group: item.id,  // 取上層的 bim_group ID
                    value: bc.value,     // 取 category 的 value
                    selected: bc.selected // 保持 selected 屬性
                }))
            )
            .filter(bc => bc.selected); // 只保留被選中的項目
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
        if (!this.criteria || this.isLoading) return; // 避免初始化時觸發

        let request: any = {};
        if (this.keyword) request.value = this.keyword;

        if (Array.isArray(this.categories) && this.categories.length > 0) {
            request.category = JSON.stringify(this.categories);
        }
        request.page = page;
        request.size = this.rowsPerPage;

        if (!request.value && !request.category) {
            this.data = { count: 0, results: [] };
            this._changeDetectorRef.markForCheck();
            return;
        }

        console.log(request)
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