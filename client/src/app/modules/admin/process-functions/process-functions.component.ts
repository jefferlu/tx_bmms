import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';

import { ApsViewerComponent } from "../../../layout/common/aps-viewer/aps-viewer.component";
import { SearchPanelComponent } from './search-panel/search-panel.component';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { ProcessFunctionsService } from './process-functions.service';
import { finalize, Subject, takeUntil } from 'rxjs';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { MatDialog } from '@angular/material/dialog';
import { CdkScrollable } from '@angular/cdk/scrolling';

@Component({
    selector: 'app-process-functions',
    templateUrl: './process-functions.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatButtonModule, MatIconModule,
        MatMenuModule, MatDividerModule,
        TableModule, SkeletonModule,
        TranslocoModule, CdkScrollable,
        SearchPanelComponent,
    ]
})
export class ProcessFunctionsComponent implements OnInit, OnDestroy {

    private _unsubscribeAll: Subject<any> = new Subject<any>();
    @ViewChild('dataTable') dataTable: Table;

    data: any = { count: 0, results: [] };
    page = {}

    criteria: any[];
    keyword: string;
    categories: any;
    selectedItems!: any;

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _translocoService: TranslocoService,
        private _matDialog: MatDialog,
        private _toastService: ToastService,
        private _processFunctionsService: ProcessFunctionsService
    ) { }

    ngOnInit(): void {

        // Get criteria
        this._processFunctionsService.criteria$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((criteria: any) => {
                this.criteria = criteria;
            });

        // this.page.svf = {
        //     "id": 6,
        //     "name": "SL_OM_IN(整合)_A棟.nwd", 
        //     "filePath": "./uploads/SL_OM_IN(%E6%95%B4%E5%90%88)_A%E6%A3%9F.nwd", 
        //     // "svfPath": "downloads/dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Ym1tc19vc3MvU0xfT01fSU4oJUU2JTk1JUI0JUU1JTkwJTg4KV9BJUU2JUEzJTlGLm53ZA/4755652b-a8e4-4d79-b049-b9ee252c3efe"
        //     "svfPath":"assets/downloads/api/M3-SE/Resource/3D/66962af7-0ae4-4b15-ae0b-0dbba901a673-000c9ef2"
        //     // "svfPath":"assets/downloads/vscode/M3-SE/dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Ym1tc19vc3MvVDMtVFAwMS1UWDEtWFgtWFhYLU0zLVNFLTAwNzAwLTcwMDIucnZ0/407b931a-5787-573b-581d-5b899a978233"
        // }

        this.page = { "urn": "urn:dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Ym1tc19vc3NfMjUwMjEwMjIxMDQ1L1QzLVRQMDEtVFgxLVhYLVhYWC1NMy1FRS0wMDAwMS03MDAyLm53Yw" }


    }


    onCategoryChange(categories: any[]) {
        this.categories = categories;
    }

    onKeywordChange(keyword: string) {
        this.keyword = keyword;
    }

    onSearch() {
        this.selectedItems = null;
        this.loadInitialData();
    }

    loadBimObjects(event: TableLazyLoadEvent) {
        console.log('loadBimObjects triggered, first:', event.first, 'rows:', event.rows);
        let request: any = {};
        if (this.keyword) request.value = this.keyword;
        if (Array.isArray(this.categories) && this.categories.length > 0) {
            request.category = this.categories.join(',');
        }

        const rows = event.rows ?? 100;
        const page = Math.floor((event.first ?? 0) / rows) + 1;
        request.page = page;
        request.size = 100;

        if (!request.value && !request.category) {
            this.data = { count: 0, results: [] };
            event.forceUpdate();
            this._changeDetectorRef.markForCheck();
            return;
        }

        this._processFunctionsService.getData(request)
            .pipe(
                takeUntil(this._unsubscribeAll),
                finalize(() => { })
            )
            .subscribe({
                next: (res) => {
                    if (res) {
                        this.data.count = res.count ?? 0; // 更新總筆數
                        Array.prototype.splice.apply(this.data.results, [event.first, rows, ...res.results]);
                        console.log('Lazy data loaded, count:', this.data.count, 'results length:', this.data.results.length);
                        event.forceUpdate();
                        this._changeDetectorRef.markForCheck();
                    }
                },
                error: (err) => {
                    console.error('Error:', err);
                    event.forceUpdate();
                    this._changeDetectorRef.markForCheck();
                }
            });
    }

    onClickAggregated(): void {
        if (!this.selectedItems) {
            this._toastService.open({ message: `${this._translocoService.translate('select-at-least-one-model')}.` });
            return;
        }
        // if (!this.checkTenderConsistency(this.selectedItems)) {
        //     this._toastService.open({ message: `${this._translocoService.translate('unsupported-aggregated-view')}.` });
        //     return;
        // }

        this.showAggregatedDialog()
    }

    showAggregatedDialog(): void {
        this._matDialog.open(ApsViewerComponent, {
            width: '99vw',
            height: '95vh',
            data: this.selectedItems
        })
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    private loadInitialData() {
        let request: any = {};
        if (this.keyword) request.value = this.keyword;
        if (Array.isArray(this.categories) && this.categories.length > 0) {
            request.category = this.categories.join(',');
        }
        request.page = 1;
        request.size = 100;

        if (!request.value && !request.category) {
            this.data = { count: 0, results: [] };
            this.resetTableScroll();
            this._changeDetectorRef.markForCheck();
            return;
        }

        this._processFunctionsService.getData(request)
            .pipe(
                takeUntil(this._unsubscribeAll),
                finalize(() => { })
            )
            .subscribe({
                next: (res) => {
                    console.log(res)

                    if (res && res.count > 0) {
                        this.data.count = res.count ?? 0;
                        this.data.results = Array.from({ length: res.count ?? 0 });
                        Array.prototype.splice.apply(this.data.results, [0, res.results.length, ...res.results]);
                        console.log('Initial data loaded, count:', this.data.count, 'results length:', this.data.results.length);
                        this.resetTableScroll();
                        this._changeDetectorRef.markForCheck();
                    }
                    else {
                        this.data = { count: 0, results: [] };
                        this._changeDetectorRef.markForCheck();
                    }
                },
                error: (err) => {
                    console.error('Error:', err);
                    this.data = { count: 0, results: [] };
                    this.resetTableScroll();
                    this._changeDetectorRef.markForCheck();
                }
            });
    }

    private resetTableScroll() {
        if (this.dataTable) {
            this.dataTable.scrollToVirtualIndex(0); // 滾動到第 0 行
        }
    }
}
