import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation, ElementRef } from '@angular/core';
import { Subject, merge } from 'rxjs';
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
    categories: { bim_group: number; value: string; selected: boolean }[] = [];
    selectedItems: SearchResultItem[] = [];
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
        this._route.data.subscribe({
            next: (res: RouteData) => {
                this.bimModels = res.data.models;
                this.groups = res.data.groups;

                this.tenderOptions = [...new Set<string>(res.data.models.map(model => model.tender))]
                    .map(tender => ({ label: tender, value: tender }));

                if (this.tenderOptions.length > 0) {
                    this.selectedTender = this.tenderOptions[0].value;
                    this.onTenderChange(this.selectedTender);
                }
                this._changeDetectorRef.markForCheck();
            },
            error: (e) => console.error('Error loading data:', e)
        });

        this.filterChangeSubject
            .pipe(
                debounceTime(500),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe(() => {
                this.onSearch();
                this.scrollToTable();
            });
    }

    onKeywordChange(event: Event): void {
        const element = event.target as HTMLInputElement;
        this.keyword = element.value;
        this.filterChangeSubject.next();
    }

    onTenderChange(selectedTender: string): void {
        this.selectedTender = selectedTender;
        this.selectedNames = [];
        this.nameOptions = this.bimModels
            .filter(model => model.tender === selectedTender)
            .map(model => ({ label: model.name, value: model }));
        this.updateCriteria(this.getCategoryIdsFromTender(selectedTender));

        // this.filterChangeSubject.next();
        this.dataTable?.reset();
        this.data = null;
    }

    onNameSelectionChange(event: any): void {
        const categoryIds = this.selectedNames.length === 0
            ? this.getCategoryIdsFromTender(this.selectedTender!)
            : this.getCategoryIdsFromNames(this.selectedNames);
        this.updateCriteria(categoryIds);
        // this.filterChangeSubject.next();
        this.dataTable?.reset();
        this.data = null;
    }

    onSelected(category: BimCategory): void {
        category.selected = !category.selected;
        this.categories = this.criteria
            .flatMap(group => group.bim_categories.map(bc => ({
                bim_group: group.id,
                value: bc.value,
                selected: bc.selected || false
            })))
            .filter(bc => bc.selected);

        if (this.categories.length > 0)
            this.filterChangeSubject.next();
        this._changeDetectorRef.markForCheck();
    }

    onCollapse(criterion: BimGroup): void {
        criterion.collapse = !criterion.collapse;
        this._changeDetectorRef.markForCheck();
    }

    onSearch(): void {
        this.selectedItems = [];
        this.dataTable?.reset();
        this.loadPage(1);
    }

    loadPage(page: number): void {
        if (!this.criteria || this.isLoading) return;

        const request: any = {
            page,
            size: this.rowsPerPage,
            ...(this.keyword && { value: this.keyword }),
            ...(this.categories.length > 0 && { category: JSON.stringify(this.categories) })
        };

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

    onPageChange(event: TableLazyLoadEvent): void {
        const page = event.first! / event.rows! + 1;
        this.loadPage(page);
    }

    onRowSelect(event: any): void {
        this._changeDetectorRef.markForCheck();
    }

    onRowUnselect(event: any): void {
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

    private updateCriteria(categoryIds: number[]): void {
        this.criteria = this.groups
            .map(group => ({
                ...group,
                bim_categories: group.bim_categories.filter(category => categoryIds.includes(category.id))
            }))
            .filter(group => group.bim_categories.length > 0);
        this._changeDetectorRef.markForCheck();
    }

    private scrollToTable(): void {
        if (this.dataTableElement) {
            this.dataTableElement.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    onClickAggregated(): void {
        if (!this.selectedItems.length) {
            this._toastService.open({ message: this._translocoService.translate('select-at-least-one-model') });
            return;
        }
        this.showAggregatedDialog();
    }

    showAggregatedDialog(): void {
        this._matDialog.open(ApsViewerComponent, {
            width: '99vw',
            height: '95vh',
            data: this.selectedItems
        });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }
}