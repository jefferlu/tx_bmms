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
    private isLocalMode: boolean = false; // 追蹤是否為本地模式

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
            } else {
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
        // 更新 dbids，合併相同 URN 的 dbid
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

        // 收集所有需要載入的新模型
        const newBubbleNodes: any[] = [];
        const allDbIds: { dbId: number, model: any }[] = [];

        // 處理現有模型的隔離和視圖更新
        this.dbids.forEach((entry) => {
            const urn = entry.urn;
            const dbIds = entry.dbid;

            let targetModel = this.loadedModels.find((model) => model.getData().urn === urn);

            if (targetModel) {
                // 模型已載入，更新隔離狀態
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
            } else {
                // 模型未載入，準備載入新模型
                const dataItem = newData.find(item => item.urn === urn);
                if (dataItem) {
                    if (this.isLocalMode && dataItem.svf) {
                        const svf = dataItem.svf.replace(/\\/g, '/');
                        newBubbleNodes.push({ type: 'geometry', svf, urn });
                    } else if (!this.isLocalMode) {
                        newBubbleNodes.push({ urn, type: 'geometry' }); // 將在後續 OSS 載入中處理
                    }
                }
            }
        });

        // 載入新模型（如果有）
        if (newBubbleNodes.length > 0) {
            if (this.isLocalMode) {
                // 本地模式：追加新模型到現有聚合視圖
                this.viewer.setNodes([...this.viewer.getNodes(), ...newBubbleNodes]).then(() => {
                    this.loadedModels = this.viewer.viewer.getAllModels();

                    // 更新新載入模型的隔離狀態
                    newBubbleNodes.forEach((node) => {
                        const urn = node.urn;
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
                }).catch((err) => {
                    this._toastService.open({ message: '無法載入部分模型' });
                });
            } else {
                // OSS 模式：逐一載入新模型
                this._appService.getToken().subscribe((aps: any) => {
                    newBubbleNodes.forEach((node) => {
                        const urn = node.urn;
                        const documentId = `urn:${urn}`;
                        Autodesk.Viewing.Document.load(documentId, (doc) => {
                            const viewables = doc.getRoot().search({ type: 'geometry' });
                            if (viewables.length > 0) {
                                this.viewer.viewer.loadDocumentNode(doc, viewables[0]).then(() => {
                                    this.loadedModels = this.viewer.viewer.getAllModels();
                                    const targetModel = this.loadedModels.find((model) => model.getData().urn === urn);
                                    if (targetModel) {
                                        const dbIds = this.dbids.find(entry => entry.urn === urn)?.dbid || [];
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
                                }).catch((err) => {
                                    this._toastService.open({ message: `無法載入模型 ${urn}` });
                                });
                            }
                        }, (errorCode, errorMsg) => {
                            this._toastService.open({ message: `無法載入文件 ${urn}` });
                        });
                    });
                });
            }
        }

        // 統一適配視圖，確保所有隔離節點可見
        if (allDbIds.length > 0) {
            const uniqueModels = [...new Set(allDbIds.map(item => item.model))];
            const dbIds = allDbIds.map(item => item.dbId);
            try {
                if (uniqueModels.length === 1) {
                    // 單模型情況，使用單模型 fitToView
                    this.viewer.viewer.fitToView(dbIds, uniqueModels[0]);
                } else {
                    // 多模型情況，確保模型有效
                    const validModels = uniqueModels.filter(model => model && model.getData && model.getInstanceTree);
                    if (validModels.length > 0) {
                        this.viewer.viewer.fitToView(dbIds, validModels);
                    } else {
                    }
                }
            } catch (err) {
                console.error('fitToView 失敗:', err);
                this._toastService.open({ message: '無法適配視圖' });
                // 後備：逐模型適配
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
                const nodeLabel = target ? target.querySelector('label')?.textContent : null;
                const modelId = target ? target.closest('[lmv-modelid]')?.getAttribute('lmv-modelid') : null;

                let model = this.viewer.viewer.model || this.viewer;
                if (modelId && this.loadedModels) {
                    model = this.loadedModels.find((m: any) => m.id === parseInt(modelId, 10)) || model;
                }

                if (dbId && !isNaN(dbId)) {
                    const tree = model.getInstanceTree();
                    if (tree && tree.nodeAccess.getIndex(dbId) !== -1) {
                        this.viewer.viewer.select([dbId], model);
                    } else {
                        
                    }
                } else {
                    
                    setTimeout(() => {
                        const viewerSelection = this.viewer.viewer.getSelection();
                        if (viewerSelection.length > 0) {
                            
                            this.viewer.viewer.select([viewerSelection[0]], model);
                        } else {
                            
                        }
                    }, 100);
                }
            });

            ['mousedown', 'click'].forEach(eventType => {
                modelStructure.container.addEventListener(eventType, (event: any) => {
                    
                });
            });
        } else {
            
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
                        } else {
                            
                        }
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.TOOLBAR_CREATED_EVENT, () => {
                        this.addGuiButton();
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, () => {
                        this.setupModelBrowser();
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_UNAVAILABLE_EVENT, () => {
                        
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
                        
                        if (this.viewer.viewer.modelstructure) {
                            this.setupModelBrowser();
                        } else {
                            
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
                        } else {
                            
                        }
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, () => {
                        
                        this.setupModelBrowser();
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_UNAVAILABLE_EVENT, () => {
                        
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
                        
                        if (this.viewer.viewer.modelstructure) {
                            this.setupModelBrowser();
                        } else {
                            
                        }
                    });

                    const documentId = `urn:${data.urn}`;
                    Autodesk.Viewing.Document.load(documentId, (doc: any) => {
                        const viewables = doc.getRoot().search({ type: 'geometry' });
                        if (viewables.length > 0) {
                            this.viewer.loadDocumentNode(doc, viewables[0]).then(() => {
                                this.isViewerInitialized = true;
                            }).catch((err: any) => {
                                
                            });
                        }
                    }, (errorCode: number, errorMsg: string) => {
                        
                    });
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
            this.viewer = new Autodesk.Viewing.AggregatedView();

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
                    this.viewer.init(container, options).then(() => {
                        const bubbleNodes: any[] = [];
                        let loadedCount = 0;

                        data.forEach((d) => {
                            const documentId = `urn:${d.urn}`;
                            Autodesk.Viewing.Document.load(documentId, (doc: any) => {
                                const bubbleRoot = doc.getRoot();
                                if (bubbleRoot) {
                                    const nodes = bubbleRoot.search({ type: 'geometry' });
                                    bubbleNodes.push(nodes[0]);
                                    this.viewer.setNodes(bubbleNodes);
                                    loadedCount++;
                                    if (loadedCount === data.length) {
                                        this.isViewerInitialized = true;
                                        this.loadedModels = this.viewer.viewer.getAllModels();

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

                                            if (this.dbids && this.dbids.length > 0) {
                                                const modelStructure = this.viewer.viewer.modelstructure;
                                                if (modelStructure) {                                                    

                                                    this.dbids.forEach((entry: any) => {
                                                        const urn = entry.urn;
                                                        const dbIds = entry.dbid;

                                                        const targetModel = this.loadedModels.find((model: any) => {
                                                            return model.getData().urn === urn;
                                                        });

                                                        if (targetModel) {
                                                            this.viewer.viewer.isolate(dbIds, targetModel);
                                                            this.viewer.viewer.fitToView([dbIds[dbIds.length - 1]], targetModel);

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
                                }
                            }, (errorCode: number, errorMsg: string) => {
                                console.error('載入模型失敗', errorMsg);
                            });
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