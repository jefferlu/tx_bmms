import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation, ElementRef } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Table, TableModule, TableLazyLoadEvent } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { TreeSelectModule } from 'primeng/treeselect';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { ApsViewerComponent } from "../../../layout/common/aps-viewer/aps-viewer.component";
import { ProcessFunctionsService } from './process-functions.service';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AnyCatcher } from 'rxjs/internal/AnyCatcher';
import { MatMenuModule } from '@angular/material/menu';
import { NgTemplateOutlet } from '@angular/common';
import { property } from 'lodash';

@Component({
    selector: 'app-process-functions',
    templateUrl: './process-functions.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule, NgTemplateOutlet,
        MatButtonModule, MatIconModule, MatMenuModule,
        TableModule, TranslocoModule,
        SelectModule, TreeSelectModule,
        ApsViewerComponent
    ],
    standalone: true
})
export class ProcessFunctionsComponent implements OnInit, OnDestroy {
    private _cache = new Map<string, any>();
    private _unsubscribeAll: Subject<void> = new Subject<void>();

    regions: any;
    spaces: any;
    systems: any;

    selectedRegions: any = [];
    selectedSpaces: any = [];
    selectedSystems: any = []
    keyword: string = '';

    rowsPerPage: number = 100;
    selectedObjects: any[] = [];

    criteriaRegions: string = '';
    criteriaSpaces: string = '';
    criteriaSystems: string = '';
    criteriaKeyword: string = '';

    nodeInfo: any;

    data: any = { count: 0, results: [] };
    isLoading: boolean = false;

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
            next: (res: any) => {
                this.regions = res.data.regions;

                res.data.conditions = this._transformData(res.data.conditions);
                const spaceNode = res.data.conditions.find(item => item.label === 'space');
                this.spaces = spaceNode?.children ?? [];
                const systemNode = res.data.conditions.find(item => item.label === 'system');
                this.systems = systemNode?.children ?? [];

                console.log(res.data)
                this._changeDetectorRef.markForCheck();
            },
            error: (e) => console.error('Error loading data:', e)
        });

    }

    onNodeSelect(event: any, tag: string) {
        const node = event.node;
        if (node.children && node.children.length > 0) {
            switch (tag) {
                case 'region': this.selectedRegions = []; break;
                case 'space': this.selectedSpaces = []; break;
                case 'system': this.selectedSystems = []; break;
            }
        }
    }

    onRowSelect(event: any): void {
        this.selectedObjects = [...this.selectedObjects, event.data];
        this.nodeInfo = null;
        this._changeDetectorRef.markForCheck();
    }

    onRowUnselect(event: any): void {
        this.selectedObjects = this.selectedObjects.filter(item => item.id !== event.data.id);
        this.nodeInfo = null;
        this._changeDetectorRef.markForCheck();
    }

    onPageChange(event: TableLazyLoadEvent): void {
        const page = event.first! / event.rows! + 1;
        this.loadPage(page);
    }

    onSearch(): void {

        if ([this.selectedObjects, this.selectedSpaces, this.selectedSystems].every(arr => arr.length === 0) &&
            this.keyword === '') {
            this._toastService.open({ message: `${this._translocoService.translate('select-at-least-one-criteria')}.` });
            return;
        }

        this.selectedObjects = [];
        this.nodeInfo = null;

        this.loadPage(1)
    }

    loadPage(page?: number): void {

        // if (!this.regions || this.isLoading) return;

        // 處理 regions
        const regionsMap = {};

        this.selectedRegions.forEach((region) => {
            // 統一處理 data 為陣列
            const data = Array.isArray(region.data) ? region.data : [region.data];
            data.forEach((item) => {
                const modelId = item.bim_model_id;
                const dbid = item.dbid;
                if (!regionsMap[modelId]) {
                    regionsMap[modelId] = new Set();
                }
                regionsMap[modelId].add(dbid);
            });
        });

        // 轉換 regionsMap 為目標格式
        const regions = Object.entries(regionsMap).map(([modelId, dbids]) => ({
            bim_model: parseInt(modelId),
            dbids: Array.from(dbids as any),
        }));

        // 處理 category
        const categories = [
            ...this.selectedSpaces,
            ...this.selectedSystems
        ].map((space: any) => ({
            bim_model: space.bim_model,
            display_name: space.display_name,
            value: space.label
        }));

        // 產生最終 request
        const request = {
            page,
            size: this.rowsPerPage,
            ...(regions.length > 0 && { regions }),
            ...(categories.length > 0 && { categories }),
            ...(this.keyword && { fuzzy_keyword: this.keyword }),
        };

        const cacheKey = JSON.stringify(request);
        if (this._cache.has(cacheKey)) {
            this.data = this._cache.get(cacheKey);
            this.updateCriteria();
            this._changeDetectorRef.markForCheck();
            return;
        }

        // if (!request.fuzzy_keyword && !request.regions) {
        //     this.data = { count: 0, results: [] };
        //     this._changeDetectorRef.markForCheck();
        //     return;
        // }

        this.isLoading = true;
        console.log(request)
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
                    console.log(res)
                    if (res && res.count >= 0 && res.results) {
                        this.data = { count: res.count, results: res.results };
                        this._cache.set(cacheKey, this.data);
                    } else {
                        this.data = { count: 0, results: [] };
                    }

                    this.updateCriteria();
                    this._changeDetectorRef.markForCheck();
                },
                error: (err) => {
                    console.error('Error:', err);
                    this.data = { count: 0, results: [] };
                    this._changeDetectorRef.markForCheck();
                }
            });
    }

    updateCriteria() {
        this.criteriaRegions = this.formatCriteria(this.selectedRegions);
        this.criteriaSpaces = this.formatCriteria(this.selectedSpaces);
        this.criteriaSystems = this.formatCriteria(this.selectedSystems);
        this.criteriaKeyword = this.keyword;
    }

    // 處理從 ApsViewerComponent 發送的節點屬性
    onProperties(event: any): void {
        this.nodeInfo = {
            dbId: event.dbId,
            modelUrn: event.modelUrn,
            name: event.name || 'Unknown',
            properties: event.properties || []
        };
        console.log('Node info:', this.nodeInfo);
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    // 格式化 selectedRegions
    private formatCriteria(criteria: any[]): string {
        if (!Array.isArray(criteria) || criteria.length === 0) {
            return null;
        }

        const groupedRegions = criteria.reduce((acc: { [key: string]: string[] }, node) => {
            if (!node || !node.label || !node.parent || !node.parent.label) {
                return acc;
            }
            const parentLabel = node.parent.label;
            if (!acc[parentLabel]) {
                acc[parentLabel] = [];
            }
            acc[parentLabel].push(node.label);
            return acc;
        }, {});

        return Object.entries(groupedRegions)
            .map(([parentLabel, childLabels]: [string, string[]]) => {
                return `${parentLabel}: ${childLabels.join(', ')}`;
            })
            .join('; ');
    }

    private _transformData(data: any[]): any[] {
        // 按 name 分組節點
        const groupedNodes: { [name: string]: any[] } = {};
        data.forEach(item => {
            if (this._hasCategories(item)) {
                const name = item.name;
                if (!groupedNodes[name]) {
                    groupedNodes[name] = [];
                }
                groupedNodes[name].push(item);
            }
        });

        // 轉換分組後的節點
        return Object.keys(groupedNodes).map(name => {
            const group = groupedNodes[name];
            // 選擇第一個節點的 id 作為 key
            const firstItem = group[0];

            // 合併所有 categories
            const categoryChildren: any[] = group
                .flatMap(item => item.categories || []) // 處理 categories 缺失
                .map((category: any) => ({
                    key: category.id.toString(), // 使用 category.id 作為 key
                    label: category.value, // 使用 category.value 作為 label
                    bim_model: category.bim_model,
                    display_name: category.display_name,
                    icon: '', // 為 category 節點設置圖標
                }));

            // 遞歸處理所有子節點
            const originalChildren: any[] = group
                .flatMap(item => item.children || []) // 處理 children 缺失
                .length > 0
                ? this._transformData(group.flatMap(item => item.children || []))
                : [];

            return {
                key: firstItem.id.toString(), // 使用第一個節點的 id 作為 key
                label: name, // 使用 name 作為 label
                children: [...categoryChildren, ...originalChildren], // 合併 categories 和子節點
                icon: categoryChildren.length > 0 || originalChildren.length > 0 ? 'pi pi-fw pi-folder' : 'pi pi-fw pi-file'
            };
        });
    }

    private _hasCategories(item: any): boolean {
        // 檢查當前節點是否有 categories（需檢查是否存在且不為空）
        if (item.categories?.length > 0) {
            return true;
        }
        // 遞歸檢查子節點
        if (item.children?.length > 0) {
            return item.children.some((child: any) => this._hasCategories(child));
        }
        return false;
    }
}