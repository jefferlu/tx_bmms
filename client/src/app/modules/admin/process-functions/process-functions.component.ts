import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation, ElementRef } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { TreeSelectModule } from 'primeng/treeselect';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { ProcessFunctionsService } from './process-functions.service';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { NgTemplateOutlet } from '@angular/common';
import { ApsViewerComponent } from 'app/layout/common/aps-viewer/aps-viewer.component';

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
        AutoCompleteModule, ApsViewerComponent
    ],
    standalone: true
})
export class ProcessFunctionsComponent implements OnInit, OnDestroy {

    @ViewChild('viewer') viewer: ApsViewerComponent;

    private _cache = new Map<string, any>();
    private _unsubscribeAll: Subject<void> = new Subject<void>();

    // bimCriteria: any;
    regions: any;
    roles: any;
    spaces: any;
    systems: any;
    objects: any = { count: 0, results: [] };
    focusObject: any;

    request: any = {};
    selectedRegions: any = [];
    selectedSpaces: any = [];
    selectedSystems: any = [];

    selectedRegion: any | undefined;
    selectedRole: any | undefined;
    selectedLevel: any | undefined;

    keyword: any;
    keywordItems: any[];
    suggestions: any[];
    // selectedObjects: any[] = [];

    first: number = 0;
    rowsPerPage: number = 1000;


    // criteriaRegions: string = '';
    // criteriaSpaces: string = '';
    // criteriaSystems: string = '';
    criteriaRegion: string = '';
    criteriaRole: string = '';
    criteriaLevel: string = '';
    criteriaKeyword: string = '';

    nodeInfo: any;

    isLoading: boolean = false;

    constructor(
        private _route: ActivatedRoute,
        private _changeDetectorRef: ChangeDetectorRef,
        private _translocoService: TranslocoService,
        private _toastService: ToastService,
        private _processFunctionsService: ProcessFunctionsService
    ) { }

    ngOnInit(): void {
        this._route.data.subscribe({
            next: (res: any) => {
                // this.regions = this.transformRegions(res.data.regions);
                this.regions = res.data.regions;
                this.suggestions = res.data.suggestions;

                // res.data.conditions = this._transformData(res.data.conditions);
                // const spaceNode = res.data.conditions.find(item => item.label === 'space');
                // this.spaces = spaceNode?.children ?? [];
                // const systemNode = res.data.conditions.find(item => item.label === 'system');
                // this.systems = systemNode?.children ?? [];

                this._changeDetectorRef.markForCheck();
            },
            error: (e) => console.error('Error loading data:', e)
        });

        // Get user info
        this.onReadCriteria();
        // this._processFunctionsService.getCriteria()
        //     .pipe(takeUntil(this._unsubscribeAll))
        //     .subscribe((user: any) => {
        //         this.bimCriteria = user.bim_criteria;

        //         this.selectedRegion = this.bimCriteria.region;
        //         this.selectedRole = this.bimCriteria.role;
        //         this.selectedLevel = this.bimCriteria.level;
        //         this.keyword = this.bimCriteria.keyword;

        //         const page = this.bimCriteria.page || 1;
        //         this.first = (page - 1) * this.rowsPerPage; // 計算 first
        //         this.loadPage(page);

        //         // Check if bimCriteria has request
        //         // if (this.bimCriteria && Object.keys(this.bimCriteria).length > 0 &&
        //         //     ![this.bimCriteria?.regions, this.bimCriteria?.spaces, this.bimCriteria.systems].every(arr => arr?.length === 0)) {
        //         //     // Load page with bimCriteria.request
        //         //     this.selectedRegions = this.bimCriteria.regions;
        //         //     this.selectedSpaces = this.bimCriteria.spaces;
        //         //     this.selectedSystems = this.bimCriteria.systems;

        //         //     const page = this.bimCriteria.page || 1;
        //         //     this.first = (page - 1) * this.rowsPerPage; // 計算 first
        //         //     this.loadPage(page);
        //         // }

        //         this._changeDetectorRef.markForCheck();
        //     });

    }

    // onNodeSelect() {
    //     // 重置相關狀態
    //     this.request = {};
    //     this.selectedObjects = [];
    //     this.objects = { count: 0, results: [] };
    //     this.nodeInfo = null;

    //     this._changeDetectorRef.markForCheck();
    // }

    onChangeRegion() {
        this.selectedRole = undefined;
        this.selectedLevel = undefined;
    }

    onChangeRole() {
        this.selectedLevel = undefined;
    }

    onClear() {
        // this.request = {};
        // // this.selectedObjects = [];
        this.objects = { count: 0, results: [] };
        this.nodeInfo = null;
    }

    keywordSearch(event: any) {
        const query = event.query.toLowerCase();
        this.keywordItems = this.suggestions.filter(item =>
            item.label.toLowerCase().includes(query)
        );
    }
    // onClear(tag: string) {
    //     this.request = {};
    //     this.selectedObjects = [];
    //     this.objects = { count: 0, results: [] };
    //     this.nodeInfo = null;

    //     switch (tag) {
    //         case 'region': this.selectedRegions = []; break;
    //         case 'space': this.selectedSpaces = []; break;
    //         case 'system': this.selectedSystems = []; break;
    //     }
    // }

    onFitToObject(item: any) {
        this.viewer.fitToObject({ urn: item.urn, dbIds: [item.dbid] });
    }

    onRowSelect(event: any): void {
        // this.selectedObjects = [...this.selectedObjects, event.data];
        // if (this.selectedObjects.length === 0) this.nodeInfo = null;
        // this._changeDetectorRef.markForCheck();
    }

    onRowUnselect(event: any): void {
        // this.selectedObjects = this.selectedObjects.filter(item => item.id !== event.data.id);
        // if (this.selectedObjects.length === 0) this.nodeInfo = null;
        // this._changeDetectorRef.markForCheck();
    }

    onPageChange(event: TableLazyLoadEvent): void {
        this.first = event.first || 0;
        this.rowsPerPage = event.rows || this.rowsPerPage;
        const page = this.first / this.rowsPerPage + 1;
        this.loadPage(page);
    }

    onSearch(): void {
        // if ([this.selectedRegions, this.selectedSpaces, this.selectedSystems].every(arr => arr.length === 0) &&
        //     this.keyword === '') {
        //     this._toastService.open({ message: `${this._translocoService.translate('select-at-least-one-criteria')}.` });
        //     return;
        // }

        if ([this.selectedRegion, this.selectedRole, this.selectedLevel].every(val => val == null) && !this.keyword) {
            this._toastService.open({ message: `${this._translocoService.translate('select-at-least-one-criteria')}.` });
            return;
        }

        // this.selectedObjects = [];
        // this.nodeInfo = null;

        this.onClear(); //觸發aps-viewer的ngOnDestroy()避免模型累積載入
        this.loadPage(1);
    }

    loadPage(page?: number): void {
        // 更新 first
        this.first = (page - 1) * this.rowsPerPage;

        // 處理 regions
        // const regionsMap = {};

        // this.selectedRegions.forEach((region) => {
        //     // 統一處理 data 為陣列
        //     const data = Array.isArray(region.data) ? region.data : [region.data];
        //     data.forEach((item) => {
        //         const modelId = item.bim_model_id;
        //         const dbid = item.dbid;
        //         if (!regionsMap[modelId]) {
        //             regionsMap[modelId] = new Set();
        //         }
        //         regionsMap[modelId].add(dbid);
        //     });
        // });

        // // 轉換 regionsMap 為目標格式
        // const regions = Object.entries(regionsMap).map(([modelId, dbids]) => ({
        //     bim_model: parseInt(modelId),
        //     dbids: Array.from(dbids as any),
        // }));

        const regions = [{
            zone_id: this.selectedRegion ? this.selectedRegion.id : null,
            role_id: this.selectedRole ? this.selectedRole.id : null,
            level: this.selectedLevel ? this.selectedLevel.label : null
        }];

        // 處理 category
        const categories = [
            ...this.selectedSpaces,
            ...this.selectedSystems
        ].map((space: any) => ({
            bim_model: space.bim_model,
            display_name: space.display_name,
            value: space.label
        }));

        // 處理keyword
        this.keyword = this._handleKeyword(this.keyword);

        // 產生最終 request
        this.request = {
            page,
            size: this.rowsPerPage,
            ...(regions.length > 0 && { regions }),
            ...(categories.length > 0 && { categories }),
            ...(this.keyword && { fuzzy_keyword: this.keyword }),
        };

        // const cacheKey = JSON.stringify(this.request);
        // if (this._cache.has(cacheKey)) {

        //     this.objects = this._cache.get(cacheKey);
        //     // this.selectedObjects = this.objects.results;
        //     this.updateCriteria();

        //     if (this.bimCriteria?.objects?.length > 0 && !this.bimCriteria.isRead) {
        //         // this.selectedObjects = this.bimCriteria.objects;
        //         this.bimCriteria.isRead = true;
        //     }
        //     this._changeDetectorRef.markForCheck();
        //     return;
        // }

        this.isLoading = true;
        this._processFunctionsService.getData(this.request)
            .pipe(
                takeUntil(this._unsubscribeAll),
                finalize(() => {
                    this.isLoading = false;
                    this._changeDetectorRef.markForCheck();
                })
            )
            .subscribe({
                next: (res) => {
                    if (res && res.count > 0) {
                        this.objects = { count: res.count, results: res.results };
                        this._changeDetectorRef.detectChanges();

                        this.viewer.refresh(this.objects.results);
                        // this.selectedObjects = res.results;
                        // this._cache.set(cacheKey, this.objects);
                    } else {
                        this.objects = { count: 0, results: [] };
                        this._toastService.open({ message: '找不到符合的模型物件' });
                    }

                    this.updateCriteria();

                    // Set selectedObjects if bimCriteria has objects and they exist in this.objects.results
                    // if (this.bimCriteria?.objects?.length > 0 && this.objects?.results?.length > 0) {
                    // const validIds = new Set(this.objects.results.map((item: any) => item.id));
                    // const validObjects = this.bimCriteria.objects.filter((obj: any) => validIds.has(obj.id));
                    // if (this.selectedObjects.length > 0)
                    //     this.selectedObjects = [this.selectedObjects, ...validObjects];
                    // else
                    //     this.selectedObjects = validObjects;
                    // debugger;

                    // if (this.bimCriteria?.objects?.length > 0 && !this.bimCriteria.isRead) {
                    //     // this.selectedObjects = this.bimCriteria.objects;
                    //     this.bimCriteria.isRead = true;
                    // }
                    this._changeDetectorRef.markForCheck();
                },
                error: (err) => {
                    console.error('Error:', err);
                    this.objects = { count: 0, results: [] };
                    this._changeDetectorRef.markForCheck();
                }
            });
    }

    onDownloadCsv() {
        this._processFunctionsService.downloadCsv(this.request).subscribe({
            next: (blob: Blob) => {
                // 使用固定檔名
                const csvFilename = 'BIM_Results.csv';

                // 創建 Blob 並生成臨時 URL
                const downloadUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = csvFilename; // 使用固定檔名
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(downloadUrl); // 清理臨時 URL
                this.isLoading = false;
                this._changeDetectorRef.markForCheck();
            },
            error: (error) => {
                this.isLoading = false;
                this._changeDetectorRef.markForCheck();

                // 檢查 Content-Type 是否為 JSON
                const contentType = error.headers?.get('Content-Type') || '';
                if (contentType.includes('application/json')) {
                    // 如果是 JSON，解析錯誤訊息
                    error.error.text().then((errorMessage: string) => {
                        try {
                            const errorJson = JSON.parse(errorMessage);
                            this._toastService.open({
                                message: errorJson.detail || errorJson.error || errorJson.message || '下載失敗，請稍後再試'
                            });
                        } catch (parseError) {
                            this._toastService.open({ message: '下載失敗，無法解析錯誤訊息，請聯繫管理員' });
                        }
                    }).catch(() => {
                        this._toastService.open({ message: '下載失敗，請聯繫管理員' });
                    });
                } else {
                    // 非 JSON 回應（例如純文字或意外的 Blob）
                    error.error.text().then((errorMessage: string) => {
                        this._toastService.open({ message: errorMessage || '下載失敗，請聯繫管理員' });
                    }).catch(() => {
                        this._toastService.open({ message: '下載失敗，請聯繫管理員' });
                    });
                }
            }
        });
    }

    onDownloadTxt() {
        this._processFunctionsService.downloadTxt(this.request).subscribe({
            next: (blob: Blob) => {
                // 使用固定檔名
                const txtFilename = 'BIM_Results.txt';

                // 創建 Blob 並生成臨時 URL
                const downloadUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = txtFilename; // 使用固定檔名
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(downloadUrl); // 清理臨時 URL
                this.isLoading = false;
                this._changeDetectorRef.markForCheck();
            },
            error: (error) => {
                this.isLoading = false;
                this._changeDetectorRef.markForCheck();

                // 檢查 Content-Type 是否為 JSON
                const contentType = error.headers?.get('Content-Type') || '';
                if (contentType.includes('application/json')) {
                    // 如果是 JSON，解析錯誤訊息
                    error.error.text().then((errorMessage: string) => {
                        try {
                            const errorJson = JSON.parse(errorMessage);
                            this._toastService.open({
                                message: errorJson.detail || errorJson.error || errorJson.message || '下載失敗，請稍後再試'
                            });
                        } catch (parseError) {
                            this._toastService.open({ message: '下載失敗，無法解析錯誤訊息，請聯繫管理員' });
                        }
                    }).catch(() => {
                        this._toastService.open({ message: '下載失敗，請聯繫管理員' });
                    });
                } else {
                    // 非 JSON 回應（例如純文字或意外的 Blob）
                    error.error.text().then((errorMessage: string) => {
                        this._toastService.open({ message: errorMessage || '下載失敗，請聯繫管理員' });
                    }).catch(() => {
                        this._toastService.open({ message: '下載失敗，請聯繫管理員' });
                    });
                }
            }
        });
    }

    onSaveCriteria() {
        // 構建要儲存的 bim_criteria 資料
        const bimCriteria = {
            page: this.request.page || 1,
            // objects: this.selectedObjects,
            // regions: this.selectedRegions.map(node => ({ key: node.key, label: node.label, data: node.data, parentLabel: node.parent?.label })),
            // spaces: this.selectedSpaces.map(node => ({ key: node.key, label: node.label, bim_model: node.bim_model, display_name: node.display_name, parentLabel: node.parent?.label })),
            // systems: this.selectedSystems.map(node => ({ key: node.key, label: node.label, bim_model: node.bim_model, display_name: node.display_name, parentLabel: node.parent?.label }))
            region: this.selectedRegion,
            role: this.selectedRole,
            level: this.selectedLevel,
            keyword: this.keyword
        };

        console.log(bimCriteria)

        // 調用服務發送資料到後端
        this._processFunctionsService.updateCriteria(bimCriteria)
            .subscribe({
                next: (response) => {
                    this._toastService.open({ message: `${this._translocoService.translate('bim-criteria-saved')}.` });
                },
                error: (error) => {
                    console.error('Error saving BIM criteria:', error);
                }
            });
    }

    onReadCriteria() {
        this.onClear();
        this._processFunctionsService.getCriteria()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((user: any) => {
                const criteria = user.bim_criteria;

                this.selectedRegion = criteria.region;
                this.selectedRole = criteria.role;
                this.selectedLevel = criteria.level;
                this.keyword = criteria.keyword;

                const page = criteria.page || 1;
                this.first = (page - 1) * this.rowsPerPage; // 計算 first
                this.loadPage(page);

                // this.selectedObjects = [];
                // this.bimCriteria.isRead = false;

                // this._processFunctionsService.getCriteria()
                //     .pipe(takeUntil(this._unsubscribeAll))
                //     .subscribe((user: any) => {
                //         this.bimCriteria = user.bim_criteria;

                //         // Check if bimCriteria has request
                //         if (this.bimCriteria && Object.keys(this.bimCriteria).length > 0 &&
                //             ![this.bimCriteria?.regions, this.bimCriteria?.spaces, this.bimCriteria.systems].every(arr => arr?.length === 0)) {
                //             // Load page with bimCriteria.request
                //             this.selectedRegions = this.bimCriteria.regions;
                //             this.selectedSpaces = this.bimCriteria.spaces;
                //             this.selectedSystems = this.bimCriteria.systems;

                //             const page = this.bimCriteria.page || 1;
                //             this.first = (page - 1) * this.rowsPerPage; // 計算 first
                //             this.loadPage(page);
                //         }

                this._changeDetectorRef.markForCheck();
            });
    }

    updateCriteria() {
        // this.criteriaRegions = this.formatCriteria(this.selectedRegion);
        // this.criteriaSpaces = this.formatCriteria(this.selectedSpaces);
        // this.criteriaSystems = this.formatCriteria(this.selectedSystems);
        this.criteriaRegion = this.selectedRegion ? this.selectedRegion.label : undefined;
        this.criteriaRole = this.selectedRole ? this.selectedRole.label : undefined;
        this.criteriaLevel = this.selectedLevel ? this.selectedLevel.label : undefined;
        this.criteriaKeyword = this.keyword ? this.keyword.label : undefined;
    }

    // 處理從 ApsViewerComponent 發送的節點屬性
    onProperties(event: any): void {

        event.properties = [{ 'displayName': 'Name', 'displayValue': event.name }, ...event.properties];
        const properties = Array.from(
            new Map(event.properties.map(item => [item.displayName, item])).values()
        );

        this.nodeInfo = {
            dbId: event.dbId,
            modelUrn: event.modelUrn,
            name: event.name || 'Unknown',
            properties: properties
        };
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    // 格式化 criteria
    private formatCriteria(criteria: any[]): any {
        if (!Array.isArray(criteria) || criteria.length === 0) {
            return [];
        }

        // 按 parent.label 或 parentLabel 分組
        const groupedRegions = criteria.reduce((acc: { [key: string]: string[] }, node) => {
            // 檢查節點有效性
            if (!node || !node.label) {
                return acc;
            }

            // 獲取父標籤，優先使用 parent.label，後備使用 parentLabel
            const parentLabel = node.parent?.label || node.parentLabel || 'Unknown';

            // 初始化分組
            if (!acc[parentLabel]) {
                acc[parentLabel] = [];
            }

            // 添加 label 到對應分組
            acc[parentLabel].push(node.label);
            return acc;
        }, {});

        // 轉為目標格式
        return Object.entries(groupedRegions).map(([name, criteria]: [string, string[]]) => ({
            name,
            criteria: criteria.join(',')
        }));
    }

    private transformRegions(data: any[]): any[] {
        return data.map(item => {
            const hasChildren = item.children && item.children.length > 0;
            const children = hasChildren ? this.transformRegions(item.children) : [];

            return {
                key: item.key,
                label: item.label,
                code: item.code,
                data: item.data,
                children,
                icon: hasChildren ? 'pi pi-fw pi-folder' : 'pi pi-fw pi-file',
                selectable: hasChildren ? false : true
            };
        });
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
                    selectable: true, // 葉節點可選
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
                icon: categoryChildren.length > 0 || originalChildren.length > 0 ? 'pi pi-fw pi-folder' : 'pi pi-fw pi-file',
                selectable: false, // 父節點不可選
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

    private _handleKeyword(item) {
        if (typeof item === 'string') {
            // 沒有找到 → 自訂輸入
            item = {
                label: item,
                display_name: null
            };
        }

        return item;
    }
}