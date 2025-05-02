import { AfterViewInit, Component, ElementRef, EventEmitter, Inject, Input, OnChanges, OnDestroy, OnInit, Optional, Output, SimpleChanges, ViewChild, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AppService } from 'app/app.service';
import { environment } from 'environments/environment';
import { ToastService } from '../toast/toast.service';
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
                console.log('Data changed significantly:', newData);
                if (this.isViewerInitialized && Array.isArray(newData)) {
                    this.updateViewer(newData);
                } else {
                    if (this.isViewerInitialized) {
                        this.cleanupViewer();
                    }
                    this.debouncedLoadViewer();
                }
            } else {
                console.log('Data change ignored, no Viewer reload needed');
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
                        acc[item.urn].dbid.push(item.dbid);
                    }
                    return acc;
                }, {})
            )
            : null;

        if (Array.isArray(this.data)) {
            this.loadAggregatedView_oss(this.data);
        } else {
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
                        acc[item.urn].dbid.push(item.dbid);
                    }
                    return acc;
                }, {})
            )
            : null;

        if (!this.viewer || !this.viewer.viewer) {
            console.error('Viewer 未初始化，無法增量更新');
            this.processDataAndLoadViewer();
            return;
        }

        this.dbids.forEach((entry) => {
            const urn = entry.urn;
            const dbIds = entry.dbid;

            const targetModel = this.loadedModels.find((model) => model.getData().urn === urn);
            if (targetModel) {
                this.viewer.viewer.isolate(dbIds, targetModel);
                this.viewer.viewer.fitToView([dbIds[0]], targetModel);
                console.log(`Updated model ${urn} with dbIds:`, dbIds);

                const tree = targetModel.getInstanceTree();
                if (tree && this.viewer.viewer.modelstructure) {
                    dbIds.forEach((dbid) => {
                        const nodePath = this.getNodePath(tree, dbid);
                        if (nodePath) {
                            this.expandNodePathInTree(tree, nodePath, this.viewer.viewer.modelstructure, targetModel);
                        }
                    });
                }
            } else {
                this._appService.getToken().subscribe((aps: any) => {
                    const documentId = `urn:${urn}`;
                    Autodesk.Viewing.Document.load(documentId, (doc) => {
                        const viewables = doc.getRoot().search({ type: 'geometry' });
                        if (viewables.length > 0) {
                            this.viewer.viewer.loadDocumentNode(doc, viewables[0]).then(() => {
                                this.loadedModels = this.viewer.viewer.getAllModels();
                                const newModel = this.loadedModels.find((model) => model.getData().urn === urn);
                                if (newModel) {
                                    this.viewer.viewer.isolate(dbIds, newModel);
                                    this.viewer.viewer.fitToView([dbIds[0]], newModel);
                                    console.log(`Loaded new model ${urn} with dbIds:`, dbIds);
                                }
                            }).catch((err) => {
                                console.error(`Failed to load model ${urn}:`, err);
                            });
                        }
                    }, (errorCode, errorMsg) => {
                        console.error(`Failed to load document ${urn}:`, errorMsg);
                    });
                });
            }
        });

        this.loadedModels.forEach((model) => {
            const urn = model.getData().urn;
            if (!this.dbids.some((entry) => entry.urn === urn)) {
                this.viewer.viewer.unloadModel(model);
                console.log(`Unloaded model ${urn}`);
            }
        });
        this.loadedModels = this.viewer.viewer.getAllModels();
    }

    private cleanupViewer(): void {
        if (this.viewer) {
            try {
                if (this.isViewerInitialized) {
                    console.log('Cleaning up initialized Viewer');
                    if (this.viewer.viewer) {
                        this.viewer.viewer.finish();
                    } else {
                        this.viewer.finish();
                    }
                } else {
                    console.log('Cleaning up uninitialized Viewer');
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
                console.error('Viewer 清理失敗:', e);
                this._toastService.open({ message: 'Failed to clean up Viewer' });
            }
        }
        if (this.viewerContainer) {
            this.viewerContainer.nativeElement.innerHTML = '';
        }
        this.isViewerInitialized = false;
    }

    private emitNodeProperties(dbId: number, model: any): void {
        this.viewer.viewer.getProperties(dbId, (result) => {
            console.log('Node properties:', result);
            const filteredProperties = result.properties.filter((prop: any) => prop.displayName.startsWith('COBie'));
            const name = result.name ||
                filteredProperties.find((prop: any) => prop.displayName === 'COBie.Space.Name')?.displayValue ||
                filteredProperties.find((prop: any) => prop.displayName === 'Name')?.displayValue ||
                'Unknown';
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
            console.error(`Failed to get properties for dbId ${dbId}:`, error);
        });
    }

    private expandNodePathInTree(tree: any, nodePath: any, modelStructure: any, model: any) {
        if (modelStructure) {
            nodePath.forEach((dbId: number) => {
                this.viewer.viewer.select([dbId], model);
                console.log(`Selected node ${dbId} in model ${model.getData().urn}`);
                this.emitNodeProperties(dbId, model);
            });
        } else {
            console.error('無法獲取 modelStructure');
        }
    }

    private setupModelBrowser(): void {
        const modelStructure = this.viewer.viewer.modelstructure;
        if (modelStructure) {
            console.log('Setting up Model Browser listeners for:', modelStructure);
            console.log('ModelStructure container:', modelStructure.container);
            console.log('ModelStructure properties:', Object.keys(modelStructure));

            // modelStructure.setVisible(true);

            modelStructure.container.addEventListener('mouseup', (event: any) => {
                console.log('Model Browser mouseup event:', event);
                const target = event.target.closest('[lmv-nodeid]');
                const dbId = target ? parseInt(target.getAttribute('lmv-nodeid'), 10) : null;
                const nodeLabel = target ? target.querySelector('label')?.textContent : null;
                const modelId = target ? target.closest('[lmv-modelid]')?.getAttribute('lmv-modelid') : null;

                console.log('Clicked element HTML:', target?.outerHTML);
                console.log('Clicked element attributes:', target ? Array.from(target.attributes).map((attr: any) => `${attr.name}: ${attr.value}`) : null);
                console.log('Node label:', nodeLabel);
                console.log('Model ID:', modelId);

                let model = this.viewer.viewer.model || this.viewer;
                if (modelId && this.loadedModels) {
                    model = this.loadedModels.find((m: any) => m.id === parseInt(modelId, 10)) || model;
                }

                if (dbId && !isNaN(dbId)) {
                    console.log(`Model Browser mouseup, detected dbId: ${dbId}, model:`, model.getData()?.urn);
                    const tree = model.getInstanceTree();
                    if (tree && tree.nodeAccess.getIndex(dbId) !== -1) {
                        console.log(`dbId ${dbId} is valid in instance tree`);
                        this.viewer.viewer.select([dbId], model);
                    } else {
                        console.warn(`dbId ${dbId} is invalid in instance tree`);
                    }
                } else {
                    console.log('Model Browser mouseup: No valid dbId detected');
                    setTimeout(() => {
                        const viewerSelection = this.viewer.viewer.getSelection();
                        if (viewerSelection.length > 0) {
                            console.log(`Model Browser mouseup, viewer selection: ${viewerSelection[0]}`);
                            this.viewer.viewer.select([viewerSelection[0]], model);
                        } else {
                            console.log('Model Browser mouseup: No viewer selection');
                        }
                    }, 100);
                }
            });

            ['mousedown', 'click'].forEach(eventType => {
                modelStructure.container.addEventListener(eventType, (event: any) => {
                    console.log(`Model Browser ${eventType} event:`, event);
                });
            });
        } else {
            console.error('ModelStructure 未初始化，無法設置監聽器');
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
                            console.log('沒有選中任何物件');
                        }
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.TOOLBAR_CREATED_EVENT, () => {
                        this.addGuiButton();
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, () => {
                        console.log('Object tree created, setting up Model Browser');
                        this.setupModelBrowser();
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_UNAVAILABLE_EVENT, () => {
                        console.warn('Object tree unavailable, Model Browser may not be initialized');
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
                        console.log('Geometry loaded, checking modelStructure:', this.viewer.viewer.modelstructure);
                        if (this.viewer.viewer.modelstructure) {
                            // this.viewer.viewer.modelstructure.setVisible(true);
                            this.setupModelBrowser();
                        } else {
                            console.error('modelStructure 未初始化於 GEOMETRY_LOADED_EVENT');
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
                            console.log('沒有選中任何物件');
                        }
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, () => {
                        console.log('Object tree created, setting up Model Browser');
                        this.setupModelBrowser();
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_UNAVAILABLE_EVENT, () => {
                        console.warn('Object tree unavailable, Model Browser may not be initialized');
                    });

                    this.viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
                        console.log('Geometry loaded, checking modelStructure:', this.viewer.viewer.modelstructure);
                        if (this.viewer.viewer.modelstructure) {
                            // this.viewer.viewer.modelstructure.setVisible(true);
                            this.setupModelBrowser();
                        } else {
                            console.error('modelStructure 未初始化於 GEOMETRY_LOADED_EVENT');
                        }
                    });

                    const documentId = `urn:${data.urn}`;
                    Autodesk.Viewing.Document.load(documentId, (doc: any) => {
                        const viewables = doc.getRoot().search({ type: 'geometry' });
                        if (viewables.length > 0) {
                            this.viewer.loadDocumentNode(doc, viewables[0]).then(() => {
                                this.isViewerInitialized = true;
                            }).catch((err: any) => {
                                console.error('模型加載失敗:', err);
                            });
                        }
                    }, (errorCode: number, errorMsg: string) => {
                        console.error('文檔加載失敗:', errorMsg);
                    });
                });
            } catch (e) {
                console.error('Viewer 初始化錯誤:', e);
            }
        });
    }

    private addGuiButton(): void {
        if (!this.viewer.toolbar) {
            console.error('Viewer toolbar 尚未準備好');
            return;
        }

        const button = new Autodesk.Viewing.UI.Button('customButton');
        button.container.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 -1 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
        `;
        button.container.style.display = 'flex';
        button.container.style.alignItems = 'center';
        button.container.style.justifyContent = 'center';
        button.setToolTip('Search Object');

        button.onClick = () => {
            if (this.searchPanel == null) {
                this.searchPanel = new SearchPanel(this.viewer, this.viewer.container, 'customButton', 'Search Model');
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
                                        console.log('Loaded models:', this.loadedModels);

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
                                            console.log('Loaded models:', this.loadedModels);

                                            if (this.dbids && this.dbids.length > 0) {
                                                const modelStructure = this.viewer.viewer.modelstructure;
                                                if (modelStructure) {
                                                    // modelStructure.setVisible(true);
                                                    console.log('Model structure panel opened:', modelStructure);

                                                    this.dbids.forEach((entry: any) => {
                                                        const urn = entry.urn;
                                                        const dbIds = entry.dbid;

                                                        const targetModel = this.loadedModels.find((model: any) => {
                                                            return model.getData().urn === urn;
                                                        });

                                                        if (targetModel) {
                                                            this.viewer.viewer.isolate(dbIds, targetModel);
                                                            this.viewer.viewer.fitToView([dbIds[0]], targetModel);
                                                            console.log(`Isolated and fit to view for model ${urn}:`, dbIds);

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

                                                    console.log('Geometry loaded, checking modelStructure:', modelStructure);
                                                    this.setupModelBrowser();
                                                } else {
                                                    console.error('modelstructure 未初始化於 GEOMETRY_LOADED_EVENT');
                                                }
                                            }
                                        });

                                        this.loadedModels.forEach((model: any) => {
                                            model.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, () => {
                                                console.log(`Object tree created for model ${model.getData().urn}, setting up Model Browser`);
                                                this.setupModelBrowser();
                                            });
                                            model.addEventListener(Autodesk.Viewing.OBJECT_TREE_UNAVAILABLE_EVENT, () => {
                                                console.warn(`Object tree unavailable for model ${model.getData().urn}`);
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

    private addAggregatedButton(): void {
        if (!this.viewer.viewer.toolbar) {
            console.error('Viewer toolbar 尚未準備好');
            return;
        }

        const searchButton = new Autodesk.Viewing.UI.Button('search-model');
        searchButton.container.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 -1 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
        `;
        searchButton.addClass('bmms-button');
        searchButton.setToolTip('Search Object');
        searchButton.onClick = () => {
            if (this.searchPanel == null) {
                this.searchPanel = new SearchPanel(this.viewer.viewer, this.viewer.viewer.container, 'searchModel', 'Search Model');
            }
            this.searchPanel.setVisible(!this.searchPanel.isVisible());
        };

        const downloadButton = new Autodesk.Viewing.UI.Button('download-database');
        downloadButton.container.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
            </svg>
        `;
        downloadButton.addClass('bmms-button');
        downloadButton.setToolTip('Download Database');
        downloadButton.onClick = () => {
            if (this.downloadPanel == null) {
                this.downloadPanel = new DownloadPanel(this.viewer.viewer, this.viewer.viewer.container, 'downloadPanel', 'Download Database');
            }
            this.downloadPanel.setVisible(!this.downloadPanel.isVisible());
        };

        const exportButton = new Autodesk.Viewing.UI.Button('export-xlsx');
        exportButton.container.innerHTML = `
            <svg fill="currentColor" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
                class="size-6" viewBox="0 0 548.291 548.291" xml:space="preserve">
                <g>
                    <path d="M486.206,196.121H473.04v-63.525c0-0.396-0.062-0.795-0.109-1.2c-0.021-2.52-0.829-4.997-2.556-6.96L364.657,3.677
                        c-0.033-0.031-0.064-0.042-0.085-0.075c-0.63-0.704-1.364-1.29-2.143-1.796c-0.229-0.154-0.461-0.283-0.702-0.419
                        c-0.672-0.365-1.387-0.672-2.121-0.893c-0.200-0.052-0.379-0.134-0.577-0.186C358.23,0.118,357.401,0,356.562,0H96.757
                        C84.894,0,75.256,9.649,75.256,21.502v174.613H62.092c-16.971,0-30.732,13.756-30.732,30.733v159.812
                        c0,16.961,13.761,30.731,30.732,30.731h13.164V526.79c0,11.854,9.638,21.501,21.501,21.501h354.776
                        c11.853,0,21.501-9.647,21.501-21.501V417.392h13.166c16.966,0,30.729-13.764,30.729-30.731V226.854
                        C516.93,209.872,503.176,196.121,486.206,196.121z M96.757,21.502h249.054v110.006c0,5.94,4.817,10.751,10.751,10.751h94.972
                        v53.861H96.757V21.502z M314.576,314.661c-21.124-7.359-34.908-19.045-34.908-37.544c0-21.698,18.11-38.297,48.116-38.297
                        c14.331,0,24.903,3.014,32.442,6.413l-6.411,23.2c-5.091-2.446-14.146-6.037-26.598-6.037s-18.488,5.662-18.488,12.266
                        c0,8.115,7.171,11.696,23.58,17.921c22.446,8.305,33.013,20,33.013,37.921c0,21.323-16.415,39.435-51.318,39.435
                        c-14.524,0-28.861-3.769-36.031-7.737l5.843-23.77c7.738,3.958,19.627,7.927,31.885,7.927c13.218,0,20.188-5.47,20.188-13.774
                        C335.894,324.667,329.858,320.13,314.576,314.661z M265.917,343.9v24.157h-79.439V240.882h28.877V343.9H265.917z M94.237,368.057
                        H61.411l36.788-64.353l-35.473-62.827h33.021l11.125,23.21c3.774,7.736,6.606,13.954,9.628,21.135h0.367
                        c3.027-8.115,5.477-13.775,8.675-21.135l10.756-23.21h32.827l-35.848,62.066l37.74,65.103h-33.202l-11.515-23.022
                        c-4.709-8.855-7.73-15.465-11.316-22.824h-0.375c-2.645,7.359-5.845,13.969-9.811,22.824L94.237,368.057z M451.534,520.968H96.757
                        V417.392h354.776V520.968z M451.728,368.057l-11.512-23.022c-4.715-8.863-7.733-15.465-11.319-22.825h-0.366
                        c-2.646,7.36-5.858,13.962-9.827,22.825l-10.551,23.022h-32.836l36.788-64.353l-35.471-62.827h33.02l11.139,23.21
                        c3.77,7.736,6.593,13.954,9.618,21.135h0.377c3.013-8.115,5.459-13.775,8.671-21.135l10.752-23.21h32.835l-35.849,62.066
                        l37.733,65.103h-33.202V368.057z"/>
                </g>
            </svg>
        `;
        exportButton.addClass('bmms-button');
        exportButton.setToolTip('Export XLSX');
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
            console.error('Tree 缺少 getNodeParentId 方法:', tree);
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