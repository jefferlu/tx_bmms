import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';

import { TreeModule } from 'primeng/tree';
import { ApsViewerComponent } from "../../../layout/common/aps-viewer/aps-viewer.component";
import { SearchPanelComponent } from './search-panel/search-panel.component';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { ProcessFunctionsService } from './process-functions.service';
import { finalize, Subject, takeUntil } from 'rxjs';
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { MatDialog } from '@angular/material/dialog';
import { CdkScrollable } from '@angular/cdk/scrolling';

@Component({
    selector: 'app-process-functions',
    templateUrl: './process-functions.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CdkScrollable,
        MatButtonModule, MatIconModule,
        MatMenuModule, MatDividerModule,
        TreeModule, TableModule, SkeletonModule,
        TranslocoModule, NgxSpinnerModule,
        SearchPanelComponent,
    ]
})
export class ProcessFunctionsComponent implements OnInit, OnDestroy {

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    data: any = { count: 0, results: [] };
    page = {}
    loading: boolean = true;
    criteria: any[];
    keyword: string;
    categories: any;
    selectedItems!: any;

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _translocoService: TranslocoService,
        private _spinner: NgxSpinnerService,
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
        console.log('search')
        this.loadBimProperties({ first: 0, last: 10 }); // 預設加載第一頁
    }

    loadBimProperties(event: TableLazyLoadEvent) {
        console.log(event)
        let request: any = {}

        if (this.keyword) request.name = this.keyword;
        if (Array.isArray(this.categories)) request.category = this.categories.join(',');

        this.loading = true;
        const page = (event.first ?? 0) / (event.last ?? 10) + 1; // 轉換成 Django 的 `page` 格式
        const size = event.last ?? 10;

        // request.page = page;
        // request.size = size;

        console.log(request)

        if (JSON.stringify(request) === '{}') {
            this.data = { count: 0, results: [] }

            // this._toastService.open({ message: `${this._translocoService.translate('no-criteria')}.` });
            this._changeDetectorRef.markForCheck();
            return;
        }

        // this._spinner.show();
        this._processFunctionsService.getData(request)
            .pipe(
                takeUntil(this._unsubscribeAll),
                finalize(() => {
                    // this._spinner.hide();
                })
            )
            .subscribe({
                next: (res) => {
                    if (res) {
                        this.data = res;
                        this.loading = false;
                        this._changeDetectorRef.markForCheck();
                    }
                },
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

    ngOnDestroy(): void { }

}
