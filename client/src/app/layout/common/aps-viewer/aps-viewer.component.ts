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
    dbids: any;
    loadedModels: any;
    lang: string;
    private isViewerInitialized = false;
    private selectedNodeProperties: any[] = [];
    private isLocalMode: boolean = false;
    private loadedBubbleNodes: any[] = []; // 新增：追蹤已載入的 bubbleNodes

    private debouncedLoadViewer = debounce(() => {
        this.processDataAndLoadViewer();
    }, 500);

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

            const isDataChanged = !oldData || JSON.stringify(this.extractKeyData(newData)) !== JSON.stringify(this.extractKeyData(oldData));

            if (isDataChanged) {
                if (this.isViewerInitialized && Array.isArray(newData)) {
                    this.updateViewer(newData);
                } else {
                    if (this.isViewerInitialized) {
                        this.cleanupViewer();
                    }
                    this.debouncedLoadViewer();
                }
            }
        }
    }

    ngAfterViewInit(): void {
        if (this.data) {
            this.processDataAndLoadViewer();
        }
    }

    private extractKeyData(data: any): any {
        if (Array.isArray(data)) {
            return data.map(item => ({ urn: item.urn, dbid: item.dbid }));
        }
        return { urn: data.urn, dbid: data.dbid };
    }

    private processDataAndLoadViewer(): void {
        this.dbids = this.data && this.data.some(item => item.urn && item.dbid !== undefined)
            ? Object.values(
                this.data.reduce((acc, item) => {
                    if (item.urn && item.dbid !== undefined) {
                        if (!acc[item.urn]) {
                            acc[item.urn] = { urn: item.urn, dbid: [] };
                        }
                        acc[item.urn].dbid = [...new Set([...acc[item.urn].dbid, ...(Array.isArray(item.dbid) ? item.dbid : [item.dbid])])];
                    }
                    return acc;
                }, {})
            )
            : null;

        if (Array.isArray(this.data)) {
            this.isLocalMode = this.data.some(item => item.svf);
            if (this.isLocalMode) {
                this.loadAggregatedView(this.data);
            } else {
                this.loadAggregatedView_oss(this.data);
            }
        } else {
            this.isLocalMode = !!this.data.svf;
            this.loadGuiViewer3D(this.data);
        }
    }

    private updateViewer(newData: any[]): void {
        this.dbids = newData.some(item => item.urn && item.dbid !== undefined)
            ? Object.values(
                newData.reduce((acc, item) => {
                    if (item.urn && item.dbid !== undefined) {
                        if (!acc[item.urn]) {
                            acc[item.urn] = { urn: item.urn, dbid: [] };
                        }
                        acc[item.urn].dbid = [...new Set([...acc[item.urn].dbid, ...(Array.isArray(item.dbid) ? item.dbid : [item.dbid])])];
                    }
                    return acc;
                }, {})
            )
            : null;

        if (!this.viewer || !this.viewer.viewer) {
            this.processDataAndLoadViewer();
            return;
        }

        const allDbIds: { dbId: number, model: any }[] = [];

        // 處理現有模型的隔離
        this.dbids.forEach((entry) => {
            const urn = entry.urn;
            const dbIds = entry.dbid;

            let targetModel = this.loadedModels.find((model) => model.getData().urn === urn);

            if (targetModel) {
                this.viewer.viewer.isolate(dbIds, targetModel);

                const tree = targetModel.getInstanceTree();
                if (tree && this.viewer.viewer.modelstructure) {
                    dbIds.forEach((dbid) => {
                        const nodePath = this.getNodePath(tree, dbid);
                        if (nodePath) {
                            this.expandNodePathInTree(tree, nodePath, this.viewer.viewer.modelstructure, targetModel);
                        }
                        allDbIds.push({ dbId: dbid, model: targetModel });
                    });
                }
            }
        });

        // 收集需要載入的新模型
        const newModelPromises: Promise<any>[] = [];
        const urnSet = new Set(this.loadedModels.map((model) => model.getData().urn));

        this.dbids.forEach((entry) => {
            const urn = entry.urn;
            if (!urnSet.has(urn)) {
                const dataItem = newData.find(item => item.urn === urn);
                if (dataItem && !this.isLocalMode) {
                    const documentId = `urn:${dataItem.urn}`;
                    newModelPromises.push(
                        new Promise((resolve, reject) => {
                            Autodesk.Viewing.Document.load(documentId, (doc) => {
                                const viewables = doc.getRoot().search({ type: 'geometry' });
                                if (viewables.length > 0) {
                                    resolve({ viewable: viewables[0], urn });
                                } else {
                                    reject(new Error(`未找到 URN ${urn} 的 geometry 節點`));
                                }
                            }, (errorCode, errorMsg) => {
                                reject(new Error(`無法載入文件 ${urn}: ${errorMsg}`));
                            });
                        })
                    );
                }
            }
        });

        // 等待所有新模型載入完成
        Promise.all(newModelPromises).then((results) => {
            const newBubbleNodes = results.map(result => result.viewable);

            if (newBubbleNodes.length > 0) {
                this._appService.getToken().subscribe((aps: any) => {
                    // 合併現有節點和新節點
                    const allBubbleNodes = [...this.loadedBubbleNodes, ...newBubbleNodes];
                    this.viewer.setNodes(allBubbleNodes).then(() => {
                        // 更新 loadedBubbleNodes 和 loadedModels
                        this.loadedBubbleNodes = allBubbleNodes;
                        this.loadedModels = this.viewer.viewer.getAllModels();
                        results.forEach((result) => {
                            const urn = result.urn;
                            const dbIds = this.dbids.find(entry => entry.urn === urn)?.dbid || [];
                            const targetModel = this.loadedModels.find((model) => model.getData().urn === urn);
                            if (targetModel) {
                                this.viewer.viewer.isolate(dbIds, targetModel);
                                const tree = targetModel.getInstanceTree();
                                if (tree && this.viewer.viewer.modelstructure) {
                                    dbIds.forEach((dbid) => {
                                        const nodePath = this.getNodePath(tree, dbid);
                                        if (nodePath) {
                                            this.expandNodePathInTree(tree, nodePath, this.viewer.viewer.modelstructure, targetModel);
                                        }
                                        allDbIds.push({ dbId: dbid, model: targetModel });
                                    });
                                }
                            }
                        });

                        // 統一適配視圖
                        if (allDbIds.length > 0) {
                            const uniqueModels = [...new Set(allDbIds.map(item => item.model))];
                            const dbIds = allDbIds.map(item => item.dbId);
                            try {
                                if (uniqueModels.length === 1) {
                                    this.viewer.viewer.fitToView(dbIds, uniqueModels[0]);
                                } else {
                                    const validModels = uniqueModels.filter(model => model && model.getData && model.getInstanceTree);
                                    if (validModels.length > 0) {
                                        this.viewer.viewer.fitToView(dbIds, validModels);
                                    }
                                }
                            } catch (err) {
                                console.error('fitToView 失敗:', err);
                                this._toastService.open({ message: '無法適配視圖' });
                                uniqueModels.forEach(model => {
                                    const modelDbIds = allDbIds.filter(item => item.model === model).map(item => item.dbId);
                                    if (modelDbIds.length > 0) {
                                        try {
                                            this.viewer.viewer.fitToView(modelDbIds, model);
                                        } catch (e) {
                                            console.error(`模型 ${model.getData().urn} 的 fitToView 失敗:`, e);
                                        }
                                    }
                                });
                            }
                        }
                    }).catch((err) => {
                        console.error('載入新模型失敗:', err);
                        this._toastService.open({ message: '無法載入部分模型' });
                    });
                });
            } else if (allDbIds.length > 0) {
                // 僅更新現有模型的視圖
                const uniqueModels = [...new Set(allDbIds.map(item => item.model))];
                const dbIds = allDbIds.map(item => item.dbId);
                try {
                    if (uniqueModels.length === 1) {
                        this.viewer.viewer.fitToView(dbIds, uniqueModels[0]);
                    } else {
                        const validModels = uniqueModels.filter(model => model && model.getData && model.getInstanceTree);
                        if (validModels.length > 0) {
                            this.viewer.viewer.fitToView(dbIds, validModels);
                        }
                    }
                } catch (err) {
                    console.error('fitToView 失敗:', err);
                    this._toastService.open({ message: '無法適配視圖' });
                    uniqueModels.forEach(model => {
                        const modelDbIds = allDbIds.filter(item => item.model === model).map(item => item.dbId);
                        if (modelDbIds.length > 0) {
                            try {
                                this.viewer.viewer.fitToView(modelDbIds, model);
                            } catch (e) {
                                console.error(`模型 ${model.getData().urn} 的 fitToView 失敗:`, e);
                            }
                        }
                    });
                }
            }
        }).catch((err) => {
            console.error('載入新模型文件失敗:', err);
            this._toastService.open({ message: err.message || '無法載入新模型文件' });
        });
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
        this.loadedBubbleNodes = []; // 重置已載入的節點
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

    loadGuiViewer3D(data: any): void {
        const container = this.viewerContainer.nativeElement;
        this.viewer = new Autodesk.Viewing.GuiViewer3D(container);

        let svf = data.svf.replace(/\\/g, '/');
        const options = {
            env: 'Local',
            useConsolidation: true,
            document: `${svf}`,
            language: this.lang,
            isAEC: true
        };

        try {
            Autodesk.Viewing.Initializer(options, () => {
                this.viewer.start(options.document, options, () => {
                    this.viewer.impl.invalidate(true);
                    this.viewer.setGhosting(false);
                    this.isViewerInitialized = true;

                    this.viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, () => {
                        const selection = this.viewer.getSelection();
                        if (selection.length > 0) {
                            const dbId = selection[0];
                            this.emitNodeProperties(dbId, this.viewer);
                        }
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.TOOLBAR_CREATED_EVENT, () => {
                        this.addGuiButton();
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, () => {
                        this.setupModelBrowser();
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_UNAVAILABLE_EVENT, () => {});
                    this.viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
                        if (this.viewer.viewer.modelstructure) {
                            this.setupModelBrowser();
                        }
                    });
                }, (errorCode: number, errorMsg: string) => {
                    console.error('Viewer 啟動失敗:', errorMsg);
                });
            });
        } catch (e) {
            console.error('Viewer 初始化錯誤:', e);
        }
    }

    loadGuiViewer3D_oss(data: any): void {
        this._appService.getToken().subscribe((aps: any) => {
            const container = this.viewerContainer.nativeElement;
            this.viewer = new Autodesk.Viewing.GuiViewer3D(container);

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
                    this.viewer.start();

                    this.viewer.addEventListener(Autodesk.Viewing.TOOLBAR_CREATED_EVENT, () => {
                        this.addGuiButton();
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, () => {
                        const selection = this.viewer.getSelection();
                        if (selection.length > 0) {
                            const dbId = selection[0];
                            this.emitNodeProperties(dbId, this.viewer);
                        }
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, () => {
                        this.setupModelBrowser();
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_UNAVAILABLE_EVENT, () => {});
                    this.viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
                        if (this.viewer.viewer.modelstructure) {
                            this.setupModelBrowser();
                        }
                    });

                    const documentId = `urn:${data.urn}`;
                    Autodesk.Viewing.Document.load(documentId, (doc: any) => {
                        const viewables = doc.getRoot().search({ type: 'geometry' });
                        if (viewables.length > 0) {
                            this.viewer.loadDocumentNode(doc, viewables[0]).then(() => {
                                this.isViewerInitialized = true;
                            }).catch((err: any) => {});
                        }
                    }, (errorCode: number, errorMsg: string) => {});
                });
            } catch (e) {
                console.error('Viewer 初始化錯誤:', e);
            }
        });
    }

    private addGuiButton(): void {
        if (!this.viewer.toolbar) {
            console.error('Viewer 工具列尚未準備好');
            return;
        }

        const button = new Autodesk.Viewing.UI.Button('customButton');
        const img = document.createElement('img');
        img.src = 'assets/aps/svg/search.svg';
        img.style.width = '24px';
        img.style.height = '24px';
        button.container.appendChild(img);
        button.container.style.display = 'flex';
        button.container.style.alignItems = 'center';
        button.container.style.justifyContent = 'center';
        button.setToolTip('搜尋物件');

        button.onClick = () => {
            if (this.searchPanel == null) {
                this.searchPanel = new SearchPanel(this.viewer, this.viewer.container, 'customButton', '搜尋模型');
            }
            this.searchPanel.setVisible(!this.searchPanel.isVisible());
        };

        const subToolbar = new Autodesk.Viewing.UI.ControlGroup('customToolbar');
        subToolbar.addControl(button);
        this.viewer.toolbar.addControl(subToolbar);
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

    private loadModels(data: any[]): void {
        const urnSet = new Set<string>();
        const promises: Promise<any>[] = [];

        data.forEach((d) => {
            if (d.urn && !urnSet.has(d.urn)) {
                urnSet.add(d.urn);
                const documentId = `urn:${d.urn}`;
                promises.push(
                    new Promise((resolve, reject) => {
                        Autodesk.Viewing.Document.load(documentId, (doc: any) => {
                            const viewables = doc.getRoot().search({ type: 'geometry' });
                            if (viewables.length > 0) {
                                resolve(viewables[0]);
                            } else {
                                reject(new Error(`未找到 URN ${d.urn} 的 geometry 節點`));
                            }
                        }, (errorCode: number, errorMsg: string) => {
                            reject(new Error(`無法載入文件 ${d.urn}: ${errorMsg}`));
                        });
                    })
                );
            }
        });

        Promise.all(promises).then((viewableNodes) => {
            this.viewer.setNodes(viewableNodes).then(() => {
                this.loadedBubbleNodes = viewableNodes; // 更新已載入的節點
                this.loadedModels = this.viewer.viewer.getAllModels();
                console.log('已載入模型:', this.loadedModels);

                this.viewer.viewer.addEventListener(Autodesk.Viewing.TOOLBAR_CREATED_EVENT, () => {
                    this.addAggregatedButton();
                });

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

                    if (this.dbids && this.dbids.length > 0) {
                        const modelStructure = this.viewer.viewer.modelstructure;
                        if (modelStructure) {
                            const allDbIds: { dbId: number, model: any }[] = [];

                            this.dbids.forEach((entry: any) => {
                                const urn = entry.urn;
                                const dbIds = entry.dbid;

                                const targetModel = this.loadedModels.find((model: any) => model.getData().urn === urn);
                                if (targetModel) {
                                    this.viewer.viewer.isolate(dbIds, targetModel);
                                    console.log(`為模型 ${urn} 隔離 dbIds:`, dbIds);

                                    const tree = targetModel.getInstanceTree();
                                    if (tree) {
                                        dbIds.forEach((dbid: number) => {
                                            const nodePath = this.getNodePath(tree, dbid);
                                            if (nodePath) {
                                                this.expandNodePathInTree(tree, nodePath, modelStructure, targetModel);
                                            }
                                            allDbIds.push({ dbId: dbid, model: targetModel });
                                        });
                                    } else {
                                        console.error(`無法從模型 ${urn} 中獲取 InstanceTree`);
                                    }
                                } else {
                                    console.error(`未找到 URN 為 ${urn} 的模型`);
                                }
                            });

                            if (allDbIds.length > 0) {
                                const uniqueModels = [...new Set(allDbIds.map(item => item.model))];
                                const dbIds = allDbIds.map(item => item.dbId);
                                try {
                                    if (uniqueModels.length === 1) {
                                        this.viewer.viewer.fitToView(dbIds, uniqueModels[0]);
                                    } else {
                                        const validModels = uniqueModels.filter(model => model && model.getData && model.getInstanceTree);
                                        if (validModels.length > 0) {
                                            this.viewer.viewer.fitToView(dbIds, validModels);
                                        }
                                    }
                                } catch (err) {
                                    console.error('fitToView 失敗:', err);
                                    this._toastService.open({ message: '無法適配視圖' });
                                    uniqueModels.forEach(model => {
                                        const modelDbIds = allDbIds.filter(item => item.model === model).map(item => item.dbId);
                                        if (modelDbIds.length > 0) {
                                            try {
                                                this.viewer.viewer.fitToView(modelDbIds, model);
                                            } catch (e) {
                                                console.error(`模型 ${model.getData().urn} 的 fitToView 失敗:`, e);
                                            }
                                        }
                                    });
                                }
                            }

                            this.setupModelBrowser();
                        } else {
                            console.error('modelstructure 未初始化於 GEOMETRY_LOADED_EVENT');
                        }
                    }
                });

                this.loadedModels.forEach((model: any) => {
                    model.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, () => {
                        console.log(`為模型 ${model.getData().urn} 創建物件樹，設置模型瀏覽器`);
                        this.setupModelBrowser();
                    });
                    model.addEventListener(Autodesk.Viewing.OBJECT_TREE_UNAVAILABLE_EVENT, () => {
                        console.warn(`模型 ${model.getData().urn} 的物件樹不可用`);
                    });
                });

                this.viewer.viewer.impl.invalidate(true);
                this.viewer.viewer.setGhosting(false);
            }).catch((err: any) => {
                console.error('載入模型失敗:', err);
                this._toastService.open({ message: '無法載入模型' });
            });
        }).catch((err: any) => {
            console.error('載入 viewable 節點失敗:', err);
            this._toastService.open({ message: err.message || '無法載入模型文件' });
        });
    }

    loadAggregatedView(data: any[]): void {
        const container = this.viewerContainer.nativeElement;
        this.viewer = new Autodesk.Viewing.AggregatedView();

        const options = {
            env: 'Local',
            useConsolidation: true,
            language: this.lang,
            isAEC: true
        };

        try {
            Autodesk.Viewing.Initializer(options, () => {
                this.viewer.init(container, options).then(() => {
                    const bubbleNodes: any[] = [];
                    let loadedCount = 0;

                    data.forEach((d) => {
                        let svf = d.svf.replace(/\\/g, '/');
                        const node = {
                            type: 'geometry',
                            svf: svf,
                            urn: d.urn
                        };
                        bubbleNodes.push(node);
                        loadedCount++;
                        if (loadedCount === data.length) {
                            this.viewer.setNodes(bubbleNodes);
                            this.loadedBubbleNodes = bubbleNodes; // 更新已載入的節點
                            this.isViewerInitialized = true;
                            this.loadedModels = this.viewer.viewer.getAllModels();
                            console.log('已載入模型:', this.loadedModels);

                            this.viewer.viewer.addEventListener(Autodesk.Viewing.TOOLBAR_CREATED_EVENT, () => {
                                this.addAggregatedButton();
                            });

                            this.viewer.viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, () => {
                                const selection = this.viewer.viewer.getSelection();
                                if (selection.length > 0) {
                                    const dbId = selection[0];
                                    const model = this.viewer.viewer.model || this.loadedModels.find((m: any) => {
                                        const tree = m.getInstanceTree();
                                        return tree && tree.nodeAccess.getIndex(dbId) !== -1;
                                    }) || this.viewer;
                                    this.emitNodeProperties(dbId, model);
                                } else {
                                    console.log('沒有選中任何物件');
                                }
                            });

                            this.viewer.viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
                                this.loadedModels = this.viewer.viewer.getAllModels();
                                console.log('已載入模型:', this.loadedModels);

                                if (this.dbids && this.dbids.length > 0) {
                                    const modelStructure = this.viewer.viewer.modelstructure;
                                    if (modelStructure) {
                                        console.log('模型結構面板已開啟:', modelStructure);

                                        this.dbids.forEach((entry: any) => {
                                            const urn = entry.urn;
                                            const dbIds = entry.dbid;

                                            const targetModel = this.loadedModels.find((model: any) => {
                                                return model.getData().urn === urn;
                                            });

                                            if (targetModel) {
                                                this.viewer.viewer.isolate(dbIds, targetModel);
                                                this.viewer.viewer.fitToView([dbIds[dbIds.length - 1]], targetModel);
                                                console.log(`為模型 ${urn} 隔離並適配視圖:`, dbIds);

                                                const tree = targetModel.getInstanceTree();
                                                if (tree) {
                                                    dbIds.forEach((dbid: number) => {
                                                        const nodePath = this.getNodePath(tree, dbid);
                                                        if (nodePath) {
                                                            this.expandNodePathInTree(tree, nodePath, modelStructure, targetModel);
                                                        }
                                                    });
                                                } else {
                                                    console.error(`無法從模型 ${urn} 中獲取 InstanceTree`);
                                                }
                                            } else {
                                                console.error(`未找到 URN 為 ${urn} 的模型`);
                                            }
                                        });

                                        console.log('幾何圖形已載入，檢查 modelStructure:', modelStructure);
                                        this.setupModelBrowser();
                                    } else {
                                        console.error('modelstructure 未初始化於 GEOMETRY_LOADED_EVENT');
                                    }
                                }
                            });

                            this.loadedModels.forEach((model: any) => {
                                model.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, () => {
                                    console.log(`為模型 ${model.getData().urn} 創建物件樹，設置模型瀏覽器`);
                                    this.setupModelBrowser();
                                });
                                model.addEventListener(Autodesk.Viewing.OBJECT_TREE_UNAVAILABLE_EVENT, () => {
                                    console.warn(`模型 ${model.getData().urn} 的物件樹不可用`);
                                });
                            });
                        }
                    });

                    this.viewer.viewer.impl.invalidate(true);
                    this.viewer.viewer.setGhosting(false);
                }).catch((err: any) => {
                    console.error('AggregatedView 初始化失敗:', err);
                });
            });
        } catch (e) {
            console.error('Viewer 初始化錯誤:', e);
        }
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