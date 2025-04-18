import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation, ElementRef } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil, finalize } from 'rxjs/operators';
import { NgClass } from '@angular/common';
import { CdkScrollable } from '@angular/cdk/scrolling';
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
import { ActivatedRoute } from '@angular/router';
import { BimModel, BimCategory, BimGroup, SearchResult, RouteData, SearchResultItem } from './process-functions.types';

`
1. resolve載入models及groups
2. 從models取得tenderOptions及nameOptions
3. 當選擇tender p-select及name p-multiselect時，觸發 updateCriteria() 動態顯示類別(標籤)內容
4. 選擇的類別(標籤)記錄在 this.categories中並與keyword組合成request條件發送至後端
   (當 this.selectedNames 有值時，代表有限制查詢的檔名，需加入request中)
5. 使用filterChangeSubject及 rxjs的 debounceTime()觸發 LoadPage()調用api查詢 BimObject 結果
`
@Component({
    selector: 'app-process-functions',
    templateUrl: './process-functions.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        MatButtonModule, MatIconModule,
        MatMenuModule, MatDividerModule,
        TableModule, TranslocoModule,
        SelectModule, MultiSelectModule
    ],
    standalone: true
})
export class ProcessFunctionsComponent implements OnInit, OnDestroy {
    private _unsubscribeAll: Subject<void> = new Subject<void>();
    private _cache = new Map<string, SearchResult>();
    private filterChangeSubject: Subject<void> = new Subject<void>();

    @ViewChild('dataTable', { read: ElementRef }) dataTableElement: ElementRef;
    @ViewChild('dataTable') dataTable: Table;

    data: SearchResult = { count: 0, results: [] };
    bimModels: BimModel[] = [];
    groups: BimGroup[] = [];
    criteria: BimGroup[] = [];
    isLoading: boolean = false;
    keyword: string = '';
    categories: { bim_group: number; bim_category: number, value: string; selected: boolean }[] = []; //已選類別(標籤)
    selectedObjectItems: SearchResultItem[] = [];
    rowsPerPage: number = 100;

    tenderOptions: { label: string; value: string }[] = [];
    nameOptions: { label: string; value: BimModel }[] = [];
    selectedTender: string | null = null;
    selectedNames: BimModel[] = [];

    constructor(
        private _route: ActivatedRoute,
        private _changeDetectorRef: ChangeDetectorRef,
        private _translocoService: TranslocoService,
        private _matDialog: MatDialog,
        private _toastService: ToastService,
        private _processFunctionsService: ProcessFunctionsService
    ) { }

    ngOnInit(): void {
       
    }

    onKeywordChange(): void {
        this.filterChangeSubject.next();
    }

    

    onCollapse(criterion: BimGroup): void {
        criterion.collapse = !criterion.collapse;
        this._changeDetectorRef.markForCheck();
    }

    onPageChange(event: TableLazyLoadEvent): void {
        const page = event.first! / event.rows! + 1;
        this.loadPage(page);
    }
        
    onRowSelect(event: any): void {
        this.selectedObjectItems = [...this.selectedObjectItems, event.data];
        this._changeDetectorRef.markForCheck();
    }

    onRowUnselect(event: any): void {
        this.selectedObjectItems = this.selectedObjectItems.filter(item => item.id !== event.data.id);
        this._changeDetectorRef.markForCheck();
    }

    onSearch(): void {
        this.selectedObjectItems = [];
        this.dataTable?.reset();
        this.loadPage(1);
    }

    loadPage(page: number): void {
        if (!this.criteria || this.isLoading) return;

        console.log(this.selectedNames)
        const request: any = {
            page,
            size: this.rowsPerPage,
            ...(this.keyword && { value: this.keyword }),
            ...(this.categories.length > 0 && { category: this.categories }),
            ...(this.selectedNames.length > 0 && { model_ids: this.selectedNames.map(model => model.id) }),
        };

        console.log(request)
        const cacheKey = JSON.stringify(request);
        if (this._cache.has(cacheKey)) {
            this.data = this._cache.get(cacheKey)!;
            this._changeDetectorRef.markForCheck();
            return;
        }

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
                        this.data = { count: res.count, results: res.results };
                        this._cache.set(cacheKey, this.data);
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

    onClickAggregated(): void {
        console.log(this.selectedObjectItems)
        if (!this.selectedObjectItems.length) {
            this._toastService.open({ message: this._translocoService.translate('select-at-least-one-model') });
            return;
        }

        this._matDialog.open(ApsViewerComponent, {
            width: '99vw',
            height: '95vh',
            data: this.selectedObjectItems
        });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private clearCriteria(): void {
        this.dataTable?.reset();
        this.data = null;
        this.keyword = '';

        // reset this.criteria
        this.criteria = this.criteria.map(criterion => ({
            ...criterion,
            bim_categories: criterion.bim_categories.map(category => ({
                ...category,
                selected: false
            }))
        }));

        this._changeDetectorRef.markForCheck();
    }

    private updateCriteria(categoryIds: number[]): void {
        this.criteria = this.groups
            .map(group => ({
                ...group,
                bim_categories: group.bim_categories.filter(category => categoryIds.includes(category.id))
            }))
            .filter(group => group.bim_categories.length > 0);
        this._changeDetectorRef.markForCheck();
    }

    private updateCategories(): void {
        this.categories = this.criteria
            .flatMap(group => group.bim_categories.map(bc => ({
                bim_group: group.id,
                bim_category: bc.id,
                value: bc.value,
                selected: bc.selected || false
            })))
            .filter(bc => bc.selected);
        this._changeDetectorRef.markForCheck();
    }

    private getCategoryIdsFromTender(tender: string): number[] {
        return this.bimModels
            .filter(model => model.tender === tender)
            .flatMap(model => model.categories.map(category => category.id));
    }

    private getCategoryIdsFromNames(names: BimModel[]): number[] {
        return names.flatMap(model => model.categories.map(category => category.id));
    }



    private scrollToTable(): void {
        if (this.dataTableElement) {
            this.dataTableElement.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}