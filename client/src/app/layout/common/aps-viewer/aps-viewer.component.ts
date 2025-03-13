import { AfterViewInit, Component, ElementRef, Inject, Input, OnDestroy, OnInit, Optional, ViewChild, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AppService } from 'app/app.service';
import { environment } from 'environments/environment';
import { ToastService } from '../toast/toast.service';
import { TranslocoService } from '@jsverse/transloco';

declare const Autodesk: any;
declare const SearchPanel: any;
declare const DownloadPanel: any;
declare const ApsXLS: any;
const env = environment;

@Component({
    selector: 'aps-viewer',
    templateUrl: './aps-viewer.component.html',
    styleUrl: './aps-viewer.component.scss',
    encapsulation: ViewEncapsulation.None,
    imports: []
})
export class ApsViewerComponent implements OnInit, AfterViewInit, OnDestroy {

    @Input() option: any;
    @Input() dbids: any;
    @ViewChild('viewer') viewerContainer: ElementRef;

    viewer: any;
    searchPanel: any;
    downloadPanel: any;
    lang: any;

    private isViewerInitialized = false;

    constructor(
        @Optional() @Inject(MAT_DIALOG_DATA) public data: any,
        private _toastService: ToastService,
        private _translocoService: TranslocoService,
        private _appService: AppService
    ) { }

    ngOnInit(): void { }

    ngAfterViewInit(): void {

        let data = this.data;
        this.dbids = data.some(item => item.dbid !== undefined)
            ? [...new Set(data.map(item => item.dbid).filter(dbid => dbid !== undefined))]
            : null;

        this.lang = this.getViewerLanguage(this._translocoService.getActiveLang());

        console.log(this.lang)

        console.log(this.dbids)
        // data = { "svf": "assets/downloads/T3-TP01-TX1-B2-XXX-M3-DP-00100-7002.nwc/0/0.svf" };
        // data = { "svf": "assets/downloads/dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Ym1tc19vc3NfMjUwMjEwMjIxMDQ1L1QzLVRQMDEtVFgxLVhYLVhYWC1NMy1TRS0wMDcwMC03MDAyLm53Yw/e5cf18f9-2a3a-49ba-bfce-8268076ab202/output.svf" }
        // data = [{ "svf": "assets/downloads/T3-TP01-TX1-XX-XXX-M3-GE-00100-7002.nwc/0/0.svf" }, { "svf": "assets/downloads/dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Ym1tc19vc3NfMjUwMjEwMjIxMDQ1L1QzLVRQMDEtVFgxLVhYLVhYWC1NMy1TRS0wMDcwMC03MDAyLm53Yw/e5cf18f9-2a3a-49ba-bfce-8268076ab202/output.svf" }];
        if (Array.isArray(data)) {
            // let data = [
            //     { "svfPath": "urn:dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Ym1tc19vc3NfMjUwMjEwMjIxMDQ1L1QzLVRQMDEtVFgxLVhYLVhYWC1NMy1FRS0wMDAwMS03MDAyLm53Yw" },
            //     { "svfPath": "urn:dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Ym1tc19vc3NfMjUwMjEwMjIxMDQ1L1QzLSVFNCVCOCVBRCVFNiU5NiU4NyVFNiVCOCVBQyVFOCVBOSVBNi5ud2M" },
            // ]
            this.loadAggregatedView_oss(data);
        }
        else {
            // let data = { "urn": "assets/downloads/api/M3-SE/Resource/3D/66962af7-0ae4-4b15-ae0b-0dbba901a673-000c9ef2" }
            // let data={ "urn": "urn:dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Ym1tc19vc3NfMjUwMjEwMjIxMDQ1L1QzLVRQMDEtVFgxLVhYLVhYWC1NMy1FRS0wMDAwMS03MDAyLm53Yw" }
            this.loadGuiViewer3D(data)
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

        Autodesk.Viewing.Initializer(options, () => {
            Autodesk.Viewing.Private.InitParametersSetting.alpha = true;
            const startedCode = this.viewer.start(options.document, options, () => {
                this.viewer.impl.invalidate(true);
                this.viewer.setGhosting(false);
            });


            // 監聽 TOOLBAR_CREATED_EVENT
            this.viewer.addEventListener(Autodesk.Viewing.TOOLBAR_CREATED_EVENT, () => {
                console.log('Toolbar 已創建，加入按鈕');
                this.addGuiButton();
            });


        });

    }

    // 使用 GuiViewer3D 載入單一模型(oss)
    loadGuiViewer3D_oss(data: any): void {

        this._appService.getToken().subscribe((aps: any) => {
            const container = this.viewerContainer.nativeElement;
            this.viewer = new Autodesk.Viewing.GuiViewer3D(container);

            const options = {
                env: 'AutodeskProduction', // Autodesk 伺服器
                api: 'derivativeV2',
                language: this.lang,
                getAccessToken: (callback) => {
                    const token = aps.access_token;
                    const expiresIn = 3600;
                    callback(token, expiresIn);
                }
            };

            Autodesk.Viewing.Initializer(options, () => {

                this.viewer.start(); // 初始化並啟動 Viewer

                // 監聽 TOOLBAR_CREATED_EVENT
                this.viewer.addEventListener(Autodesk.Viewing.TOOLBAR_CREATED_EVENT, () => {
                    console.log('Toolbar 已創建，加入按鈕');
                    // this.addCustomButton();
                });

                const documentId = `urn:${data.urn}`; // 必須是 `urn:` 開頭
                Autodesk.Viewing.Document.load(documentId, (doc) => {
                    const viewables = doc.getRoot().search({ type: 'geometry' });

                    if (viewables.length > 0) {
                        this.viewer.loadDocumentNode(doc, viewables[0]); // 載入模型
                    }
                }, (errorCode, errorMsg) => {
                    console.error('載入模型失敗', errorMsg);
                });
            });
        })

    }

    addGuiButton(): void {

        if (!this.viewer.toolbar) {
            console.error('Viewer toolbar 尚未準備好');
            return;
        }

        // Search 按鈕
        const button = new Autodesk.Viewing.UI.Button('customButton');
        button.container.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 -1 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
        `;
        button.container.style.display = 'flex';
        button.container.style.alignItems = 'center';
        button.container.style.justifyContent = 'center';
        button.container.style.justifyContent = 'center';

        button.setToolTip('Search Object');

        // 設定點擊事件
        button.onClick = () => {
            if (this.searchPanel == null) {
                this.searchPanel = new SearchPanel(this.viewer, this.viewer.container, 'customButton', 'Search Model');
            }
            this.searchPanel.setVisible(!this.searchPanel.isVisible());
        };

        // 建立工具列群組
        const subToolbar = new Autodesk.Viewing.UI.ControlGroup('customToolbar');
        subToolbar.addControl(button);

        // 加入 Viewer Toolbar
        this.viewer.toolbar.addControl(subToolbar);
    }

    // 處理 AggregatedView（多模型 oss）
    loadAggregatedView(data: any[]): void {
        console.log('loadAggregatedView')
        const container = this.viewerContainer.nativeElement;
        this.viewer = new Autodesk.Viewing.AggregatedView();

        // const svfPaths = data.map(item => item.svfPath.replace(/\\/g, '/')); // 確保路徑正確

        const options = {
            env: 'Local',
            language: this.lang,
        };

        Autodesk.Viewing.Initializer(options, () => {
            this.viewer.init(container, options).then(() => {
                console.log('AggregatedView 初始化完成');

                const guiViewer = this.viewer.viewer; // 取得 GuiViewer3D
                if (!guiViewer) {
                    console.error('GuiViewer3D 尚未準備好');
                    return;
                }
                data.forEach((d) => {
                    let svf = d.svf.replace(/\\/g, '/');
                    const loadOptions = {
                        // globalOffset: { x: 0, y: 0, z: 0 } // 可選：控制模型位置
                    };
                    guiViewer.loadModel(svf, loadOptions, (model) => {
                        console.log('模型載入成功:', model);
                    });
                });

                this.viewer.viewer.impl.invalidate(true);
                this.viewer.viewer.setGhosting(false);
                this.viewer.viewer.addEventListener(Autodesk.Viewing.TOOLBAR_CREATED_EVENT, () => {
                    this.addAggregatedButton();
                });
            });
        });

    }

    loadAggregatedView_oss(data: any[]): void {
        this._appService.getToken().subscribe((aps: any) => {

            const container = this.viewerContainer.nativeElement;
            this.viewer = new Autodesk.Viewing.AggregatedView();

            // const svfPaths = data.map(item => item.svfPath.replace(/\\/g, '/')); // 確保路徑正確

            const options = {
                env: 'AutodeskProduction', // 使用 Autodesk 伺服器
                api: 'derivativeV2',
                language: this.lang,
                getAccessToken: (callback) => {
                    const token = aps.access_token;
                    const expiresIn = 3600; // Token 有效時間
                    callback(token, expiresIn);
                }
            };

            Autodesk.Viewing.Initializer(options, () => {
                this.viewer.init(container, options).then(() => {

                    const bubbleNodes = [];

                    // 逐一載入每個模型的 .svf 檔案
                    data.forEach((d) => {
                        const documentId = `urn:${d.urn}`; // 使用本地 .svf 路徑                        
                        Autodesk.Viewing.Document.load(documentId, (doc) => {
                            const bubbleRoot = doc.getRoot();

                            if (bubbleRoot) {
                                const nodes = bubbleRoot.search({ type: 'geometry' });
                                bubbleNodes.push(nodes[0]);

                                // 設置節點等後續操作
                                this.viewer.setNodes(bubbleNodes);
                            }

                        }, (errorCode, errorMsg) => {
                            console.error('載入模型失敗', errorMsg);
                        });
                    });

                    this.viewer.viewer.impl.invalidate(true);
                    this.viewer.viewer.setGhosting(false);

                    this.viewer.viewer.addEventListener(Autodesk.Viewing.TOOLBAR_CREATED_EVENT, () => {
                        this.addAggregatedButton();
                    });

                    this.viewer.viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
                        if (this.dbids) {
                            this.viewer.viewer.isolate(this.dbids); // 隔離該物件
                            this.viewer.viewer.fitToView(this.dbids); // 調整視角
                        }
                    });

                });
            });
        });
    }

    addAggregatedButton(): void {
        if (!this.viewer.viewer.toolbar) {
            console.error('Viewer toolbar 尚未準備好');
            return;
        }

        // Search Model
        const searchButton = new Autodesk.Viewing.UI.Button('search-model');
        searchButton.container.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 -1 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
        `;

        searchButton.addClass('bmms-button');
        searchButton.setToolTip('Search Object');

        // 設定點擊事件
        searchButton.onClick = () => {
            if (this.searchPanel == null) {
                console.log(this.viewer)
                this.searchPanel = new SearchPanel(this.viewer.viewer, this.viewer.viewer.container, 'searchModel', 'Search Model');
            }
            this.searchPanel.setVisible(!this.searchPanel.isVisible());
        };


        // Download Database
        const downloadButton = new Autodesk.Viewing.UI.Button('download-database');
        downloadButton.container.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />

        `;

        downloadButton.addClass('bmms-button');
        downloadButton.setToolTip('Search Object');

        // 設定點擊事件
        downloadButton.onClick = () => {
            if (this.downloadPanel == null) {
                this.downloadPanel = new DownloadPanel(this.viewer.viewer, this.viewer.viewer.container,
                    'downloadPanel', 'Download Database');
            }
            this.downloadPanel.setVisible(!this.downloadPanel.isVisible());
        };

        // Download Database
        const exportButton = new Autodesk.Viewing.UI.Button('export-xlsx');
        exportButton.container.innerHTML = `
            <svg fill="currentColor" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
                class="size-6" viewBox="0 0 548.291 548.291"
                xml:space="preserve">
            <g>
                <path d="M486.206,196.121H473.04v-63.525c0-0.396-0.062-0.795-0.109-1.2c-0.021-2.52-0.829-4.997-2.556-6.96L364.657,3.677
                    c-0.033-0.031-0.064-0.042-0.085-0.075c-0.63-0.704-1.364-1.29-2.143-1.796c-0.229-0.154-0.461-0.283-0.702-0.419
                    c-0.672-0.365-1.387-0.672-2.121-0.893c-0.2-0.052-0.379-0.134-0.577-0.186C358.23,0.118,357.401,0,356.562,0H96.757
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
        exportButton.setToolTip('Search Object');

        // 設定點擊事件
        const fileName = "metadata";
        exportButton.onClick = () => {
            ApsXLS.downloadXLSX(fileName.replace(/\./g, '') + ".xlsx", (completed, message) => {
                this._toastService.open({ message: message });
            });/*Optional*/
        };

        // 建立工具列群組
        const subToolbar = new Autodesk.Viewing.UI.ControlGroup('bmms-toolbar');
        subToolbar.addControl(searchButton);
        subToolbar.addControl(downloadButton);
        subToolbar.addControl(exportButton);

        // 加入 Viewer Toolbar
        this.viewer.viewer.toolbar.addControl(subToolbar);
    }

    private getViewerLanguage(lang: string): string {
        switch (lang) {
            case 'zh':
                return 'zh-HANT';
            case 'en':
            default:  // 默認為英文
                return 'en';
        }
    }

    ngOnDestroy(): void {
        if (this.viewer && this.isViewerInitialized) {
            this.viewer.finish();
        }
    }
}

