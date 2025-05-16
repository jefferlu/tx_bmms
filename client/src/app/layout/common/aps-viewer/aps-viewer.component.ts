import { AfterViewInit, Component, ElementRef, EventEmitter, Inject, Input, OnChanges, OnDestroy, OnInit, Optional, Output, SimpleChanges, ViewChild, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AppService } from 'app/app.service';
import { environment } from 'environments/environment';
import { ToastService } from '../../common/toast/toast.service';
import { TranslocoService } from '@jsverse/transloco';
import { debounce } from 'lodash';

declare const Autodesk: any;
declare const SearchPanel: any;
declare const DownloadPanel: any;
declare const ApsXLS: any;

const env = environment;
const MEDIA_URL = 'media/';

@Component({
    selector: 'aps-viewer',
    templateUrl: './aps-viewer.component.html',
    styleUrls: ['./aps-viewer.component.scss'],
    encapsulation: ViewEncapsulation.None
})
export class ApsViewerComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
    @Input() data: any;

    @ViewChild('viewer') viewerContainer: ElementRef;

    @Output() nodeProperties = new EventEmitter<any>();

    viewer: any;
    searchPanel: any;
    downloadPanel: any;
    loadedModels: any[] = [];
    lang: string;
    private isViewerInitialized = false;
    private selectedNodeProperties: any[] = [];
    private loadedBubbleNodes: any[] = [];
    private latestDbIds: number[] = [];
    private latestUrn: string | null = null;

    private isLocalMode: boolean = true;

    constructor(
        @Optional() @Inject(MAT_DIALOG_DATA) public dialogData: any,
        @Optional() public dialogRef: MatDialogRef<ApsViewerComponent>,
        private _toastService: ToastService,
        private _translocoService: TranslocoService,
        private _appService: AppService
    ) { }

    ngOnInit(): void {
        console.log('aps-viewer init()');
        this.data = this.data || this.dialogData;
        this.lang = this.getViewerLanguage(this._translocoService.getActiveLang());
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['data'] && changes['data'].currentValue) {
            const newData = changes['data'].currentValue;
            const oldData = changes['data'].previousValue;

            if (!Array.isArray(newData)) {
                console.warn('Input data must be an array for AggregatedView');
                return;
            }

            // 設置最新 dbid（newData 總是只新增一筆）
            if (newData.length > 0) {
                const latestEntry = newData[newData.length - 1];
                this.latestUrn = latestEntry.urn;
                this.latestDbIds = Array.isArray(latestEntry.dbid) ? latestEntry.dbid : [latestEntry.dbid];
                console.log(`最新 dbIds: ${this.latestDbIds}, urn: ${this.latestUrn}`);
            } else {
                this.latestUrn = null;
                this.latestDbIds = [];
                console.warn('newData 為空，無法設置最新 dbIds');
            }

            const isDataChanged = !oldData || JSON.stringify(this.extractKeyData(newData)) !== JSON.stringify(this.extractKeyData(oldData));

            if (isDataChanged) {
                if (this.isViewerInitialized) {
                    this.loadModels(newData);
                } else {
                    if (this.isViewerInitialized) {
                        this.cleanupViewer();
                    }
                    this.debouncedLoadViewer();
                }
            }
        }
    }

    private debouncedLoadViewer = debounce(() => {
        this.processDataAndLoadViewer();
    }, 500);

    ngAfterViewInit(): void {
        if (this.dialogData) {
            this.processDataAndLoadViewer();
        }
    }

    private extractKeyData(data: any): any {
        if (Array.isArray(data)) {
            return data.map(item => ({ urn: item.urn, dbid: item.dbid }));
        }
        return [];
    }

    private processDataAndLoadViewer(): void {
        if (!this.data || !Array.isArray(this.data)) {
            console.warn('無有效數據可載入', this.data);
            this._toastService.open({ message: '無有效數據可載入' });
            return;
        }

        // 根據 svf_path 判斷模式（假設 svf_path 表示本地模式）
        // this.isLocalMode = this.data.some(item => item.svf_path);

        if (this.isLocalMode) {
            this.loadAggregatedView(this.data);
        } else {
            this.loadAggregatedView_oss(this.data);
        }
    }

    private waitForObjectTrees(data: any[]): void {
        let loadedModelCount = 0;
        const totalModels = this.loadedModels.length;

        if (totalModels === 0) {
            console.warn('沒有已載入的模型');
            this._toastService.open({ message: '無法聚焦視圖：無模型' });
            return;
        }

        const onObjectTreeCreated = (model: any) => {
            loadedModelCount++;
            if (loadedModelCount === totalModels) {
                console.log('所有模型的物件樹已載入，執行 fitToLastModel');
                this.fitToLastModel(data);
            }
        };

        this.loadedModels.forEach((model: any) => {
            const tree = model.getInstanceTree();
            if (tree) {
                // 物件樹已存在，直接計數
                onObjectTreeCreated(model);
            } else {
                // 監聽物件樹創建事件
                model.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, () => {
                    onObjectTreeCreated(model);
                });
                model.addEventListener(Autodesk.Viewing.OBJECT_TREE_UNAVAILABLE_EVENT, () => {
                    console.warn(`模型 ${model.getData().urn} 的物件樹不可用`);
                    loadedModelCount++;
                    if (loadedModelCount === totalModels) {
                        console.log('所有模型的物件樹處理完成，執行 fitToLastModel');
                        this.fitToLastModel(data);
                    }
                });
            }
        });
    }

    private fitToLastModel(data: any[]): void {
        if (data && data.length > 0) {
            const modelStructure = this.viewer.viewer.modelstructure;
            if (!modelStructure) {
                console.error('modelstructure 未初始化，無法展開物件樹');
                return;
            }

            if (this.dialogData) return;

            // 按 urn 合併所有 dbIds
            const dbIdsByUrn = data.reduce((acc, entry) => {
                const urn = entry.urn;
                const dbIds = entry.dbid !== undefined
                    ? (Array.isArray(entry.dbid) ? entry.dbid : [entry.dbid])
                    : [1]; // 無 dbid 時設置為根節點
                if (!acc[urn]) {
                    acc[urn] = [];
                }
                acc[urn] = [...new Set([...acc[urn], ...dbIds])]; // 去重 dbIds
                return acc;
            }, {});

            // 隔離每個 urn 的所有 dbIds
            Object.entries(dbIdsByUrn).forEach(([urn, dbIds]) => {
                const targetModel = this.loadedModels.find((model: any) => model.getData().urn === urn);
                if (targetModel) {
                    this.viewer.viewer.isolate(dbIds, targetModel);
                    console.log(`為模型 ${urn} 隔離 dbIds:`, dbIds);
                } else {
                    console.warn(`未找到 URN 為 ${urn} 的模型`);
                }
            });

            // 展開物件樹
            data.forEach((entry) => {
                const urn = entry.urn;
                const dbIds = Array.isArray(entry.dbid) ? entry.dbid : [entry.dbid];
                const targetModel = this.loadedModels.find((model: any) => model.getData().urn === urn);
                if (targetModel) {
                    const tree = targetModel.getInstanceTree();
                    if (tree) {
                        dbIds.forEach((dbid: number) => {
                            if (dbid) {
                                const nodePath = this.getNodePath(tree, dbid);
                                if (nodePath) {
                                    this.expandNodePathInTree(tree, nodePath, modelStructure, targetModel);
                                }
                            }
                        });
                    } else {
                        console.error(`無法從模型 ${urn} 中獲取 InstanceTree`);
                    }
                }
            });

            // 聚焦最新 dbid
            if (this.latestUrn && this.latestDbIds.length > 0) {
                const targetModel = this.loadedModels.find((model: any) => model.getData().urn === this.latestUrn);
                if (targetModel) {
                    console.log(`聚焦模型 ${this.latestUrn}，dbIds: ${this.latestDbIds}`);
                    this.viewer.viewer.fitToView(this.latestDbIds, targetModel);
                } else {
                    console.warn(`未找到 URN 為 ${this.latestUrn} 的模型進行聚焦`);
                }
            } else {
                console.warn('無最新 dbIds 或 urn，無法聚焦');
            }
        }
    }

    private cleanupViewer(): void {
        if (this.viewer) {
            try {
                if (this.isViewerInitialized) {
                    if (this.viewer.viewer) {
                        this.viewer.viewer.finish();
                    } else {
                        this.viewer.finish();
                    }
                } else {
                    if (this.viewer.viewer) {
                        this.viewer.viewer.unload();
                        this.viewer.viewer.finish();
                    } else {
                        this.viewer.unload();
                        this.viewer.finish();
                    }
                }
                this.viewer = null;
            } catch (e) {
                this._toastService.open({ message: '無法清理 Viewer' });
            }
        }
        if (this.viewerContainer) {
            this.viewerContainer.nativeElement.innerHTML = '';
        }
        this.isViewerInitialized = false;
        this.loadedBubbleNodes = [];
    }

    private emitNodeProperties(dbId: number, model: any): void {
        this.viewer.viewer.getProperties(dbId, (result) => {
            const filteredProperties = result.properties.filter((prop: any) => prop.displayName.startsWith('COBie'));
            const name = result.name ||
                filteredProperties.find((prop: any) => prop.displayName === 'COBie.Space.Name')?.displayValue ||
                filteredProperties.find((prop: any) => prop.displayName === 'Name')?.displayValue ||
                '未知';
            const nodeInfo = {
                dbId,
                modelUrn: model.getData().urn,
                name,
                properties: filteredProperties
            };
            if (this.dialogData) {
                this.selectedNodeProperties.push(nodeInfo);
            } else {
                this.nodeProperties.emit(nodeInfo);
            }
        }, (error) => {
            console.error(`無法獲取 dbId ${dbId} 的屬性:`, error);
        });
    }

    private expandNodePathInTree(tree: any, nodePath: any, modelStructure: any, model: any) {
        if (modelStructure) {
            nodePath.forEach((dbId: number) => {
                this.viewer.viewer.select([dbId], model);
                this.emitNodeProperties(dbId, model);
            });
        } else {
            console.error('無法獲取 modelStructure');
        }
    }

    private setupModelBrowser(): void {
        const modelStructure = this.viewer.viewer.modelstructure;
        if (modelStructure) {
            modelStructure.container.addEventListener('mouseup', (event: any) => {
                const target = event.target.closest('[lmv-nodeid]');
                const dbId = target ? parseInt(target.getAttribute('lmv-nodeid'), 10) : null;
                const modelId = target ? target.closest('[lmv-modelid]')?.getAttribute('lmv-modelid') : null;

                let model = this.viewer.viewer.model || this.viewer.viewer;
                if (modelId && this.loadedModels) {
                    model = this.loadedModels.find((m: any) => m.id === parseInt(modelId, 10)) || model;
                }

                if (dbId && !isNaN(dbId)) {
                    const tree = model.getInstanceTree();
                    if (tree && tree.nodeAccess.getIndex(dbId) !== -1) {
                        this.viewer.viewer.select([dbId], model);
                    }
                }
            });
        }
    }

    loadAggregatedView_oss(data: any[]): void {
        this._appService.getToken().subscribe((aps: any) => {
            const container = this.viewerContainer.nativeElement;
            this.viewer = this.viewer || new Autodesk.Viewing.AggregatedView();

            const options = {
                env: 'AutodeskProduction',
                api: 'derivativeV2',
                language: this.lang,
                getAccessToken: (callback: any) => {
                    const token = aps.access_token;
                    const expiresIn = 3600;
                    callback(token, expiresIn);
                }
            };

            try {
                Autodesk.Viewing.Initializer(options, () => {
                    if (!this.isViewerInitialized) {
                        this.viewer.init(container, options).then(() => {
                            this.isViewerInitialized = true;
                            this.viewer.viewer.impl.invalidate(true);
                            this.viewer.viewer.setGhosting(false);
                            this.viewer.viewer.setDisplayEdges(true);
                            this.viewer.viewer.setQualityLevel(true, true);
                            this.viewer.viewer.prefs.set('reverseMouseWheel', false);

                            this.viewer.viewer.addEventListener(Autodesk.Viewing.TOOLBAR_CREATED_EVENT, () => {
                                this.addAggregatedButton();
                            });

                            this.loadModels(data);
                        }).catch((err: any) => {
                            console.error('AggregatedView 初始化失敗:', err);
                            this._toastService.open({ message: '無法初始化 AggregatedView' });
                        });
                    } else {
                        this.loadModels(data);
                    }
                });
            } catch (e) {
                console.error('Viewer 初始化錯誤:', e);
                this._toastService.open({ message: 'Viewer 初始化失敗' });
            }
        });
    }

    loadAggregatedView(data: any[]): void {
        const container = this.viewerContainer.nativeElement;
        this.viewer = this.viewer || new Autodesk.Viewing.AggregatedView();

        const options = {
            env: 'Local',
            useConsolidation: true,
            language: this.lang,
            isAEC: true
        };

        try {
            Autodesk.Viewing.Initializer(options, () => {
                if (!this.isViewerInitialized) {
                    this.viewer.init(container, options).then(() => {
                        this.isViewerInitialized = true;

                        this.viewer.viewer.setGhosting(false);
                        this.viewer.viewer.setDisplayEdges(true);
                        this.viewer.viewer.setQualityLevel(true, true);
                        this.viewer.viewer.setReverseZoomDirection(true); // 確保方向一致
                        
                        this.viewer.viewer.impl.invalidate(true);

                        this.viewer.viewer.addEventListener(Autodesk.Viewing.TOOLBAR_CREATED_EVENT, () => {
                            this.addAggregatedButton();
                        });

                        this.loadModels(data);
                    }).catch((err: any) => {
                        console.error('AggregatedView 初始化失敗:', err);
                        this._toastService.open({ message: '無法初始化 AggregatedView' });
                    });
                } else {
                    this.loadModels(data);
                }
            });
        } catch (e) {
            console.error('Viewer 初始化錯誤:', e);
            this._toastService.open({ message: 'Viewer 初始化失敗' });
        }
    }

    private loadModels(data: any[]): void {
        const guiViewer = this.viewer.viewer;
        if (!guiViewer) {
            console.error('GuiViewer3D 尚未準備好');
            this._toastService.open({ message: 'GuiViewer3D 未初始化' });
            return;
        }

        // 生成模型載入條目，包含 urn 和 dbid（無 dbid 時設置為 [1]）
        const dbids = data.some(item => item.urn)
            ? Object.values(
                data.reduce((acc, item) => {
                    if (item.urn) {
                        if (!acc[item.urn]) {
                            acc[item.urn] = { urn: item.urn, dbid: [] };
                        }
                        const itemDbids = item.dbid !== undefined
                            ? (Array.isArray(item.dbid) ? item.dbid : [item.dbid])
                            : [1]; // 無 dbid 時設置為根節點
                        acc[item.urn].dbid = [...new Set([...acc[item.urn].dbid, ...itemDbids])];
                    }
                    return acc;
                }, {})
            )
            : null;

        if (!dbids || dbids.length === 0) {
            console.warn('無有效數據可載入', data);
            this._toastService.open({ message: '無有效數據可載入' });
            return;
        }

        const loadPromises: Promise<any>[] = [];
        const urnSet = new Set(this.loadedModels.map((model) => model.getData().urn));

        dbids.forEach((entry: any) => {
            const urn = entry.urn;
            if (!urnSet.has(urn)) {
                const dataItem = data.find(item => item.urn === urn);
                if (dataItem) {
                    if (this.isLocalMode) {
                        if (!dataItem.svf_path) {
                            console.error(`缺少 svf_path 屬性，URN: ${urn}`);
                            return;
                        }
                        const svfPath = dataItem.svf_path.replace(/\\/g, '/');
                        const documentId = `${env.host}${MEDIA_URL}${svfPath}`;

                        const loadOptions = { urn: urn };

                        loadPromises.push(
                            new Promise((resolve, reject) => {
                                guiViewer.loadModel(documentId, loadOptions, (model) => {
                                    console.log(`本地模型載入成功: ${urn}`);
                                    model.getData().urn = urn;
                                    resolve({ model, urn });
                                }, (errorCode, errorMsg) => {
                                    console.error(`無法載入本地模型 ${urn}: ${errorMsg}`);
                                    reject(new Error(`無法載入本地模型 ${urn}: ${errorMsg}`));
                                });
                            })
                        );
                    } else {
                        const documentId = `urn:${dataItem.urn}`;
                        loadPromises.push(
                            new Promise((resolve, reject) => {
                                Autodesk.Viewing.Document.load(documentId, (doc) => {
                                    const viewables = doc.getRoot().search({ type: 'geometry' });
                                    if (viewables.length > 0) {
                                        console.log(`OSS viewable 節點載入成功: ${urn}`);
                                        resolve({ viewable: viewables[0], urn });
                                    } else {
                                        reject(new Error(`未找到 URN ${urn} 的 geometry 節點`));
                                    }
                                }, (errorCode, errorMsg) => {
                                    console.error(`無法載入 OSS 文件 ${urn}: ${errorMsg}`);
                                    reject(new Error(`無法載入 OSS 文件 ${urn}: ${errorMsg}`));
                                });
                            })
                        );
                    }
                }
            }
        });

        if (loadPromises.length === 0 && data) {
            this.fitToLastModel(data);
            this.handleModelLoading(data);
            return;
        }

        Promise.all(loadPromises).then((results) => {
            if (this.isLocalMode) {
                const newModels = results.map(result => result.model);
                this.loadedModels = [...this.loadedModels, ...newModels];
                console.log('更新後的本地模型:', this.loadedModels.map((model: any) => model.getData().urn || '無 URN'));
                this.loadedModels = this.viewer.viewer.getAllModels();
                this.handleModelLoading(data);
            } else {
                const newBubbleNodes = results.map(result => result.viewable);
                const allBubbleNodes = [...this.loadedBubbleNodes, ...newBubbleNodes];
                console.log('準備設置 OSS 節點:', allBubbleNodes.map(node => ({
                    urn: node.data?.urn || node.urn,
                    hasIs3D: typeof node.is3D === 'function'
                })));
                this.viewer.setNodes(allBubbleNodes).then(() => {
                    this.loadedBubbleNodes = allBubbleNodes;
                    this.loadedModels = this.viewer.viewer.getAllModels();
                    console.log('更新後的 OSS 模型:', this.loadedModels.map((model: any) => model.getData().urn || '無 URN'));
                    this.handleModelLoading(data);
                }).catch((err) => {
                    console.error('設置 OSS 模型失敗:', err);
                    this._toastService.open({ message: '無法設置 OSS 模型' });
                });
            }
        }).catch((err) => {
            console.error('載入模型失敗:', err);
            this._toastService.open({ message: err.message || '無法載入模型文件' });
        });
    }

    private handleModelLoading(data: any[]): void {
        this.viewer.viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, () => {
            const selection = this.viewer.viewer.getSelection();
            if (selection.length > 0) {
                const dbId = selection[0];
                const model = this.viewer.viewer.model || this.loadedModels.find((m: any) => {
                    const tree = m.getInstanceTree();
                    return tree && tree.nodeAccess.getIndex(dbId) !== -1;
                }) || this.viewer.viewer;
                this.emitNodeProperties(dbId, model);
            } else {
                console.log('沒有選中任何物件');
            }
        });

        this.viewer.viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {           
            this.loadedModels = this.viewer.viewer.getAllModels();
            console.log('幾何圖形已載入，模型數量:', this.loadedModels.length);

            if (data && data.length > 0) {
                const modelStructure = this.viewer.viewer.modelstructure;
                if (modelStructure) {
                    this.waitForObjectTrees(data);
                    this.setupModelBrowser();
                } else {
                    console.error('modelstructure 未初始化於 GEOMETRY_LOADED_EVENT');
                }
            }
        });
    }

    private addAggregatedButton(): void {
        if (!this.viewer.viewer.toolbar) {
            console.error('Viewer 工具列尚未準備好');
            return;
        }

        const searchButton = new Autodesk.Viewing.UI.Button('search-model');
        const searchImg = document.createElement('img');
        searchImg.src = 'assets/aps/svg/search.svg';
        searchImg.style.width = '24px';
        searchImg.style.height = '24px';
        searchButton.container.appendChild(searchImg);
        searchButton.addClass('bmms-button');
        searchButton.setToolTip('搜尋物件');
        searchButton.onClick = () => {
            if (this.searchPanel == null) {
                this.searchPanel = new SearchPanel(this.viewer.viewer, this.viewer.viewer.container, 'searchModel', '搜尋模型');
            }
            this.searchPanel.setVisible(!this.searchPanel.isVisible());
        };

        const downloadButton = new Autodesk.Viewing.UI.Button('download-database');
        const downloadImg = document.createElement('img');
        downloadImg.src = 'assets/aps/svg/download-database.svg';
        downloadImg.style.width = '24px';
        downloadImg.style.height = '24px';
        downloadButton.container.appendChild(downloadImg);
        downloadButton.addClass('bmms-button');
        downloadButton.setToolTip('下載資料庫');
        downloadButton.onClick = () => {
            if (this.downloadPanel == null) {
                this.downloadPanel = new DownloadPanel(this.viewer.viewer, this.viewer.viewer.container, 'downloadPanel', '下載資料庫');
            }
            this.downloadPanel.setVisible(!this.downloadPanel.isVisible());
        };

        const exportButton = new Autodesk.Viewing.UI.Button('export-xlsx');
        const exportImg = document.createElement('img');
        exportImg.src = 'assets/aps/svg/export-xlsx.svg';
        exportImg.style.width = '24px';
        exportImg.style.height = '24px';
        exportButton.container.appendChild(exportImg);
        exportButton.addClass('bmms-button');
        exportButton.setToolTip('匯出 XLSX');
        const fileName = "metadata";
        exportButton.onClick = () => {
            ApsXLS.downloadXLSX(fileName.replace(/\./g, '') + ".xlsx", (completed: boolean, message: string) => {
                this._toastService.open({ message: message });
            });
        };

        const subToolbar = new Autodesk.Viewing.UI.ControlGroup('bmms-toolbar');
        subToolbar.addControl(searchButton);
        subToolbar.addControl(downloadButton);
        subToolbar.addControl(exportButton);
        this.viewer.viewer.toolbar.addControl(subToolbar);
    }

    private getViewerLanguage(lang: string): string {
        switch (lang) {
            case 'zh':
                return 'zh-HANT';
            case 'en':
            default:
                return 'en';
        }
    }

    private getNodePath(tree: any, dbid: number): number[] | null {
        const path: number[] = [];
        let currentDbId = dbid;

        if (typeof tree.getNodeParentId !== 'function') {
            console.error('樹缺少 getNodeParentId 方法:', tree);
            return null;
        }

        while (currentDbId !== null) {
            path.unshift(currentDbId);
            const parentId = tree.getNodeParentId(currentDbId);
            if (parentId === null || parentId === tree.getRootId()) {
                break;
            }
            currentDbId = parentId;
        }
        return path;
    }

    ngOnDestroy(): void {
        this.cleanupViewer();
        this.debouncedLoadViewer.cancel();
        if (this.dialogData && this.selectedNodeProperties.length) {
            this.dialogRef?.close(this.selectedNodeProperties);
        }
    }
}

class ShowDbIdExtension extends Autodesk.Viewing.Extension {
    constructor(viewer: any, options: any) {
        super(viewer, options);
    }

    load(): boolean {
        console.log('ShowDbIdExtension 已載入');
        return true;
    }

    unload(): boolean {
        console.log('ShowDbIdExtension 已卸載');
        return true;
    }
}

Autodesk.Viewing.theExtensionManager.registerExtension('ShowDbIdExtension', ShowDbIdExtension);