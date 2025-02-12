import { AfterViewInit, Component, ElementRef, Inject, Input, OnDestroy, OnInit, Optional, ViewChild, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AppService } from 'app/app.service';
import { environment } from 'environments/environment';

declare const Autodesk: any;
const env = environment;

@Component({
    selector: 'aps-viewer',
    templateUrl: './aps-viewer.component.html',
    styleUrl: './aps-viewer.component.scss',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [],
})
export class ApsViewerComponent implements OnInit, AfterViewInit, OnDestroy {

    @Input() option;
    @ViewChild('viewer') viewerContainer: ElementRef;

    viewer: any;
    options: any;

    private isViewerInitialized = false;

    constructor(
        @Optional() @Inject(MAT_DIALOG_DATA) public data: any,
        private _appService: AppService
    ) { }

    ngOnInit(): void { }

    ngAfterViewInit(): void {

        let data = this.data || this.option;

        if (Array.isArray(data)) {
            // console.log(data)
            // let data = [
            //     { "svfPath": "urn:dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Ym1tc19vc3NfMjUwMjEwMjIxMDQ1L1QzLVRQMDEtVFgxLVhYLVhYWC1NMy1FRS0wMDAwMS03MDAyLm53Yw" },
            //     { "svfPath": "urn:dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Ym1tc19vc3NfMjUwMjEwMjIxMDQ1L1QzLSVFNCVCOCVBRCVFNiU5NiU4NyVFNiVCOCVBQyVFOCVBOSVBNi5ud2M" },
            // ]
            this.loadAggregatedView(data);
        }
        else {
            // let data = { "urn": "assets/downloads/api/M3-SE/Resource/3D/66962af7-0ae4-4b15-ae0b-0dbba901a673-000c9ef2" }
            // let data={ "urn": "urn:dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Ym1tc19vc3NfMjUwMjEwMjIxMDQ1L1QzLVRQMDEtVFgxLVhYLVhYWC1NMy1FRS0wMDAwMS03MDAyLm53Yw" }
            this.loadGuiViewer3D(data.urn)
        }
    }

    // 處理 GuiViewer3D（單一模型）
    // loadGuiViewer3D(data: any): void {
    //     const container = this.viewerContainer.nativeElement;
    //     this.viewer = new Autodesk.Viewing.Private.GuiViewer3D(container);

    //     const svfPath = data.svfPath.replace(/\\/g, '/');
    //     const options = {
    //         env: 'Local',
    //         useConsolidation: true,
    //         document: `${svfPath}/output.svf`,
    //         language: 'en',
    //         isAEC: true
    //     };

    //     Autodesk.Viewing.Initializer(options, () => {
    //         Autodesk.Viewing.Private.InitParametersSetting.alpha = true;

    //         this.viewer.start(options.document, options, () => {
    //             this.viewer.impl.invalidate(true);
    //             this.viewer.setGhosting(false);
    //             this.isViewerInitialized = true;
    //         });
    //     });
    // }

    // 使用 GuiViewer3D 載入單一模型(oss)
    loadGuiViewer3D(urn: string): void {
        this._appService.getToken().subscribe((aps: any) => {
            const container = this.viewerContainer.nativeElement;
            this.viewer = new Autodesk.Viewing.GuiViewer3D(container);

            const options = {
                env: 'AutodeskProduction', // Autodesk 伺服器
                api: 'derivativeV2',
                language: 'en',
                getAccessToken: (callback) => {
                    const token = aps.access_token;
                    const expiresIn = 3600;
                    callback(token, expiresIn);
                }
            };

            Autodesk.Viewing.Initializer(options, () => {
                this.viewer.start(); // 初始化並啟動 Viewer

                const documentId = `${urn}`; // 必須是 `urn:` 開頭
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

    // 處理 AggregatedView（多模型 oss）
    loadAggregatedView(data: any[]): void {
        this._appService.getToken().subscribe((aps: any) => {

            this._appService.getToken().subscribe((token: any) => { console.log('-->token') })
            const container = this.viewerContainer.nativeElement;
            this.viewer = new Autodesk.Viewing.AggregatedView();

            // const svfPaths = data.map(item => item.svfPath.replace(/\\/g, '/')); // 確保路徑正確
            // console.log(svfPaths);
            const options = {
                env: 'AutodeskProduction', // 使用 Autodesk 伺服器
                api: 'derivativeV2',
                language: 'en',
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
                        console.log(documentId);
                        Autodesk.Viewing.Document.load(documentId, (doc) => {
                            const bubbleRoot = doc.getRoot();
                            console.log(bubbleRoot);

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
                });
            });
        });
    }

    ngOnDestroy(): void {
        if (this.viewer && this.isViewerInitialized) {
            this.viewer.finish();
        }
    }
}

