import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation, ElementRef, TemplateRef } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { PortalModule } from '@angular/cdk/portal';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { TreeSelectModule } from 'primeng/treeselect';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { TabsModule } from 'primeng/tabs';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { ProcessFunctionsService } from './process-functions.service';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { NgTemplateOutlet } from '@angular/common';
import { ApsViewerComponent } from 'app/layout/common/aps-viewer/aps-viewer.component';
import { GtsConfirmationService } from '@gts/services/confirmation';

@Component({
    selector: 'app-process-functions',
    templateUrl: './process-functions.component.html',
    styleUrl: './process-functions.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule, NgTemplateOutlet,
        MatButtonModule, MatIconModule, MatMenuModule,
        TableModule, TranslocoModule, TabsModule,
        SelectModule, TreeSelectModule, OverlayModule, PortalModule,
        AutoCompleteModule, ApsViewerComponent
    ],
    standalone: true
})
export class ProcessFunctionsComponent implements OnInit, OnDestroy {

    @ViewChild('viewer') viewer: ApsViewerComponent;
    @ViewChild('overlayContent') overlayContent: TemplateRef<any>;
    @ViewChild('firstConditionGroup') firstConditionGroup: ElementRef;

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
    cobies: any[];
    // selectedObjects: any[] = [];

    // first: number = 0;
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

    conditionNames: any[];
    // 條件2選項：字串、數值
    conditionTypes = [
        { label: this._translocoService.translate('string'), value: 'string' },
        { label: this._translocoService.translate('number'), value: 'number' },
    ];

    // 條件3選項：運算符
    conditionOperators: any[] = []; // 動態運算符選項
    allOperators = {
        string: [
            { label: this._translocoService.translate('equals'), value: 'eq' },
            { label: this._translocoService.translate('contains'), value: 'contains' },
        ],
        number: [
            { label: '=', value: 'eq' },
            { label: '>', value: 'gt' },
            { label: '<', value: 'lt' },
            { label: '>=', value: 'gte' },
            { label: '<=', value: 'lte' },
            { label: this._translocoService.translate('range'), value: 'range' },
        ],
    };

    activeTab = 'basic';
    overlayRef: OverlayRef | null;
    isOverlayOpen = false;

    conditions = [
        { condition1: null, condition2: null, condition3: null, condition4: '', min_value: '', max_value: '', operators: [], },// 主畫面條件組
        { condition1: null, condition2: null, condition3: null, condition4: '', min_value: '', max_value: '', operators: [], }, // overlay條件組
    ];

    constructor(
        private _route: ActivatedRoute,
        private _changeDetectorRef: ChangeDetectorRef,
        private overlay: Overlay,
        private _translocoService: TranslocoService,
        private _gtsConfirmationService: GtsConfirmationService,
        private _toastService: ToastService,
        private _processFunctionsService: ProcessFunctionsService
    ) { }

    ngOnInit(): void {
        this._route.data.subscribe({
            next: (res: any) => {
                // this.regions = this.transformRegions(res.data.regions);
                this.regions = res.data.regions;
                this.cobies = res.data.cobies;

                // 從定義表取得cobie定義
                this.conditionNames = res.data.cobieDef;

                // 從資料集取得cobie定義
                // this.conditionNames = this.cobies.filter((item, index, self) =>
                //     index === self.findIndex(i => i.display_name === item.display_name)
                // );

                // 預設選取第一個選項
                if (this.conditionNames.length > 0) {
                    this.conditions[0].condition1 = this.conditionNames[0];
                    this.conditions[1].condition1 = this.conditionNames[0];
                }
                if (this.conditionTypes.length > 0) {
                    this.conditions[0].condition2 = this.conditionTypes[0];
                    this.conditions[1].condition2 = this.conditionTypes[0];
                }
                this.conditions.forEach(condition => this.updateOperators(condition));


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
        this.keywordItems = this.cobies.filter(item =>
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
        const first = event.first || 0;
        this.rowsPerPage = event.rows || this.rowsPerPage;
        const page = first / this.rowsPerPage + 1;
        this.loadPage(page);
    }

    onTabChange(value: string) {
        this.activeTab = value;
        this.closeOverlay();
        this.onClear();
    }

    // 更新單個條件的運算符選項
    updateOperators(condition: any) {
        const type = condition.condition2?.value || 'string';
        condition.operators = this.allOperators[type];
        condition.condition3 = condition.operators[0];
    }

    // 切換 overlay 的顯示
    toggleOverlay() {
        if (this.isOverlayOpen) {
            this.closeOverlay();
        } else {
            this.openOverlay();
        }
    }

    // 開啟 overlay
    openOverlay() {
        if (!this.firstConditionGroup) return;

        this.overlayRef = this.overlay.create({
            positionStrategy: this.overlay
                .position()
                .flexibleConnectedTo(this.firstConditionGroup)
                .withPositions([
                    {
                        originX: 'start',
                        originY: 'bottom',
                        overlayX: 'start',
                        overlayY: 'top',
                    },
                ])
                .withPush(false)
                .withViewportMargin(0)
                .withDefaultOffsetY(0),
            hasBackdrop: false,
            backdropClass: 'cdk-overlay-transparent-backdrop',
            width: this.firstConditionGroup.nativeElement.offsetWidth,
        });

        this.overlayRef.attach(this.overlayContent);
        this.isOverlayOpen = true;

        this.overlayRef.backdropClick().subscribe(() => this.closeOverlay());
    }

    // 關閉 overlay
    closeOverlay() {
        if (this.overlayRef) {
            this.overlayRef.detach();
            this.overlayRef = null;
            this.isOverlayOpen = false;

            this._changeDetectorRef.markForCheck();
        }
    }

    // 當運算符改變時，重置輸入值
    onOperatorChange(event, condition: any) {
        if (event.value.value === 'range') {
            condition.condition4 = '';
        }
        else {
            condition.min_value = '';
            condition.max_value = '';
        }
    }

    // 驗證範圍輸入
    validateRange(condition: any): boolean {
        if (condition.condition3?.value !== 'range') return true;
        const minValue = condition.min_value?.trim();
        const maxValue = condition.max_value?.trim();
        if (!minValue || !maxValue) {
            this._toastService.open({
                message: this._translocoService.translate('range_values_required'),
            });
            return false;
        }
        const minNum = Number(minValue);
        const maxNum = Number(maxValue);
        if (isNaN(minNum) || isNaN(maxNum)) {
            this._toastService.open({
                message: this._translocoService.translate('invalid_numeric_values'),
            });
            return false;
        }
        if (minNum > maxNum) {
            this._toastService.open({
                message: this._translocoService.translate('min_greater_than_max'),
            });
            return false;
        }
        return true;
    }

    // 添加新條件組
    addConditionGroup() {
        this.conditions.push({
            condition1: this.conditionNames.length > 0 ? this.conditionNames[0] : null,
            condition2: this.conditionTypes.length > 0 ? this.conditionTypes[0] : null,
            condition3: this.conditionOperators.length > 0 ? this.conditionOperators[0] : null,
            condition4: '',
            min_value: '',
            max_value: '',
            operators: this.allOperators['string'], // 預設 string
        });

        this.updateOperators(this.conditions[this.conditions.length - 1]);
    }

    // 移除條件組
    removeConditionGroup(index: number) {
        this.conditions.splice(index, 1);
        if (this.conditions.length <= 1) {
            this.closeOverlay(); // 如果只剩第一組，關閉 overlay
        }
    }

    removeAllConditinGroup() {
        this.conditions = [
            { condition1: null, condition2: null, condition3: null, condition4: '', min_value: '', max_value: '', operators: [], },// 主畫面條件組
            { condition1: null, condition2: null, condition3: null, condition4: '', min_value: '', max_value: '', operators: [], }, // overlay條件組
        ];
        this.closeOverlay();
    }

    onSearch(): void {
        this.onClear(); //觸發aps-viewer的ngOnDestroy()避免模型累積載入
        this.loadPage(1, true);
    }

    loadPage(page?: number, isClick: boolean = false): void {
        if (this.activeTab === 'basic') {
            if ([this.selectedRegion, this.selectedRole, this.selectedLevel].every(val => val == null) && !this.keyword) {
                if (isClick) this._toastService.open({ message: `${this._translocoService.translate('select-at-least-one-criteria')}.` });
                return;
            }
            // 更新 first
            // this.first = (page - 1) * this.rowsPerPage;

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

                            if (this.viewer) this.viewer.refresh(this.objects.results);
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
        else {
            const invalidRange = this.conditions.some(condition => !this.validateRange(condition));
            if (invalidRange) return;

            const validConditions = this.conditions.filter(
                condition =>
                    (condition.condition3?.value === 'range'
                        ? condition.min_value?.trim() && condition.max_value?.trim()
                        : condition.condition4 != null && condition.condition4.toString().trim() !== '') &&
                    condition.condition1?.display_name &&
                    condition.condition2?.value &&
                    condition.condition3?.value
            );

            // 如果沒有有效條件，直接返回 null 或拋出錯誤
            if (!validConditions.length) {
                if (isClick) this._toastService.open({ message: `${this._translocoService.translate('select-at-least-one-criteria')}.` });
                return;
            }

            this.closeOverlay();
            this.request = {
                page,
                size: this.rowsPerPage,
                conditions: validConditions.map(condition => ({
                    display_name: condition.condition1?.display_name,
                    operator: condition.condition3?.value,
                    ...(condition.condition3?.value === 'range'
                        ? {
                            min_value: Number(condition.min_value).toString(),
                            max_value: Number(condition.max_value).toString(),
                        }
                        : {
                            value:
                                condition.condition2?.value === 'number'
                                    ? Number(condition.condition4).toString()
                                    : condition.condition4.toString(),
                        }),
                    type: ['string', 'number'].includes(condition.condition2?.value)
                        ? condition.condition2?.value
                        : 'string',
                })),
            };

            this.isLoading = true;
            this._processFunctionsService.getAdvancedData(this.request)
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

                            if (this.viewer) this.viewer.refresh(this.objects.results);
                            // this.selectedObjects = res.results;
                            // this._cache.set(cacheKey, this.objects);
                        } else {
                            this.objects = { count: 0, results: [] };
                            this._toastService.open({ message: '找不到符合的模型物件' });
                        }

                        this.updateCriteria();

                        this._changeDetectorRef.markForCheck();
                    },
                    error: (err) => {
                        console.error('Error:', err);
                        this.objects = { count: 0, results: [] };
                        this._changeDetectorRef.markForCheck();
                    }
                });
        }
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
        let bimCriteria = undefined;
        if (this.activeTab === 'basic') {
            if (![this.selectedRegion, this.selectedRole, this.selectedLevel].every(val => val == null) || this.keyword) {
                // 構建要儲存的 bim_criteria 資料        
                bimCriteria = {
                    page: this.request.page || 1,
                    tab: this.activeTab,
                    // objects: this.selectedObjects,
                    // regions: this.selectedRegions.map(node => ({ key: node.key, label: node.label, data: node.data, parentLabel: node.parent?.label })),
                    // spaces: this.selectedSpaces.map(node => ({ key: node.key, label: node.label, bim_model: node.bim_model, display_name: node.display_name, parentLabel: node.parent?.label })),
                    // systems: this.selectedSystems.map(node => ({ key: node.key, label: node.label, bim_model: node.bim_model, display_name: node.display_name, parentLabel: node.parent?.label }))
                    region: this.selectedRegion,
                    role: this.selectedRole,
                    level: this.selectedLevel,
                    keyword: this.keyword
                };
            }
        }
        else {
            const validConditions = this.conditions.filter(
                condition => condition.condition4 != null && condition.condition4.toString().trim() !== ''
            );

            // 如果沒有有效條件，直接返回 null 或拋出錯誤
            if (validConditions.length) {
                bimCriteria = {
                    page: this.request.page || 1,
                    tab: this.activeTab,
                    conditions: this.conditions
                }
            }
        }

        // 調用服務發送資料到後端
        this._processFunctionsService.updateCriteria(bimCriteria)
            .subscribe({
                next: (response) => {
                    this._toastService.open({ message: `${this._translocoService.translate('bim-criteria-saved')}.` });
                },
                error: (error) => {
                    error.error.text().then((errorMessage: string) => {
                        const errorJson = JSON.parse(errorMessage);
                        this._toastService.open({ message: errorJson.error || errorJson.message });
                    }).catch(() => {
                        console.log({ message: '發生錯誤，請聯繫管理員' });
                    });
                }
            });
    }

    onReadCriteria() {
        this.onClear();
        this._processFunctionsService.getCriteria()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((user: any) => {

                const criteria = user.bim_criteria;
                this.activeTab = criteria.tab || this.activeTab;
                if (this.activeTab === 'basic') {

                    this.selectedRegion = criteria.region;
                    this.selectedRole = criteria.role;
                    this.selectedLevel = criteria.level;
                    this.keyword = criteria.keyword;
                }
                else {
                    if (criteria.conditions) this.conditions = criteria.conditions;
                }

                // const page = criteria.page || 1;
                // this.first = (page - 1) * this.rowsPerPage; // 計算 first
                this.loadPage(1);

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

    onClearCriteria() {
        let dialogRef = this._gtsConfirmationService.open({
            title: this._translocoService.translate('confirm-action'),
            message: this._translocoService.translate('clear-criteria-confirm'),
            icon: { color: 'primary' },
            actions: {
                confirm: { label: this._translocoService.translate('confirm') },
                cancel: { label: this._translocoService.translate('cancel') }
            }

        });

        dialogRef.afterClosed().subscribe(res => {
            if (res === 'confirmed') {
                this._changeDetectorRef.markForCheck();
                this._processFunctionsService.updateCriteria({}).subscribe({
                    next: () => {
                        this.removeAllConditinGroup();
                        this._toastService.open({ message: `${this._translocoService.translate('bim-criteria-cleared')}.` });

                        // 預設選取第一個選項
                        if (this.conditionNames.length > 0) {
                            this.conditions[0].condition1 = this.conditionNames[0];
                            this.conditions[1].condition1 = this.conditionNames[0];
                        }
                        if (this.conditionTypes.length > 0) {
                            this.conditions[0].condition2 = this.conditionTypes[0];
                            this.conditions[1].condition2 = this.conditionTypes[0];
                        }
                        this.conditions.forEach(condition => this.updateOperators(condition));

                        this._changeDetectorRef.markForCheck();
                    },
                    error: (error) => {
                        error.error.text().then((errorMessage: string) => {
                            const errorJson = JSON.parse(errorMessage);
                            this._toastService.open({ message: errorJson.error || errorJson.message });
                        }).catch(() => {
                            console.log({ message: '發生錯誤，請聯繫管理員' });
                        });
                    }
                });
            }
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