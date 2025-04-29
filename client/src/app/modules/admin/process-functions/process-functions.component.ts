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

@Component({
    selector: 'app-process-functions',
    templateUrl: './process-functions.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        MatButtonModule, MatIconModule,
        TableModule, TranslocoModule,
        SelectModule, TreeSelectModule
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
    selectedSystems: any = [];

    keyword: string = '';

    rowsPerPage: number = 100;

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
                case 'region': this.selectedRegions = null; break;
                case 'space': this.selectedSpaces = null; break;
                case 'system': this.selectedSystems = null; break;
            }

        }
    }

    onPageChange(event: TableLazyLoadEvent): void {
        const page = event.first! / event.rows! + 1;
        if (page > 1)
            this._loadPage(page);
    }

    onSearch(): void {
        this._loadPage(1)
    }

    private _loadPage(page?: number): void {
        console.log(this.selectedRegions, this.selectedSpaces)

        // 處理 regions，將 bim_model_id 和 dbid 按 model_id 分組
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
            model_id: parseInt(modelId),
            dbids: Array.from(dbids as any),
        }));

        // 處理 exact_values
        const exact_values = this.selectedSpaces.map((space) => ({
            bim_model: space.bim_model,
            dbid: space.key,
            value: space.label
        }));

        // 組裝最終 request
        const request = {
            page,
            size: this.rowsPerPage,
            ...(regions.length > 0 && { regions }),
            ...(exact_values.length > 0 && { exact_values }),
            ...(this.keyword && { fuzzy_keyword: this.keyword }),
        };

        // const request: any = {
        //     page,
        //     size: this.rowsPerPage,
        //     ...(this.selectedRegions.length > 0 && { regions: this.selectedRegions }),
        //     ...(this.selectedSpaces.length > 0 && { spaces: this.selectedSpaces.map(e => e.label) }),
        //     ...(this.keyword && { value: this.keyword }),

        // }
        console.log(request)
        return;

        // if (!this.criteria || this.isLoading) return;

        // console.log(this.selectedNames)
        // const request: any = {
        //     page,
        //     size: this.rowsPerPage,
        //     ...(this.keyword && { value: this.keyword }),
        //     ...(this.categories.length > 0 && { category: this.categories }),
        //     ...(this.selectedNames.length > 0 && { model_ids: this.selectedNames.map(model => model.id) }),
        // };

        // console.log(request)
        // const cacheKey = JSON.stringify(request);
        // if (this._cache.has(cacheKey)) {
        //     this.data = this._cache.get(cacheKey)!;
        //     this._changeDetectorRef.markForCheck();
        //     return;
        // }

        // if (!request.value && !request.category) {
        //     this.data = { count: 0, results: [] };
        //     this._changeDetectorRef.markForCheck();
        //     return;
        // }

        // this.isLoading = true;

        // this._processFunctionsService.getData(request)
        //     .pipe(
        //         takeUntil(this._unsubscribeAll),
        //         finalize(() => {
        //             this.isLoading = false;
        //             this._changeDetectorRef.markForCheck();
        //         })
        //     )
        //     .subscribe({
        //         next: (res) => {
        //             if (res && res.count >= 0 && res.results) {
        //                 this.data = { count: res.count, results: res.results };
        //                 this._cache.set(cacheKey, this.data);
        //             } else {
        //                 this.data = { count: 0, results: [] };
        //             }
        //             this._changeDetectorRef.markForCheck();
        //         },
        //         error: (err) => {
        //             console.error('Error:', err);
        //             this.data = { count: 0, results: [] };
        //             this._changeDetectorRef.markForCheck();
        //         }
        //     });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
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
                    icon: 'pi pi-fw pi-tag', // 為 category 節點設置圖標
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