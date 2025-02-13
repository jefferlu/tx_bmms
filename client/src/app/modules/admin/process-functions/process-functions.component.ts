import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterOutlet } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { TreeNode } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { TreeModule } from 'primeng/tree';
import { JsonPipe } from '@angular/common';
import { ApsViewerComponent } from "../../../layout/common/aps-viewer/aps-viewer.component";
import { SearchPanelComponent } from './search-panel/search-panel.component';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { environment } from 'environments/environment';

// declare var $: any;
// const endpoint = environment.elfinder;

@Component({
    selector: 'app-process-functions',
    templateUrl: './process-functions.component.html',
    styleUrl: './process-functions.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatButtonModule, MatIconModule,
        TreeModule, TableModule,
        TranslocoModule,
        SearchPanelComponent,
        ApsViewerComponent,
        MatMenuModule,
        MatDividerModule,
    ]
})
export class ProcessFunctionsComponent implements OnInit, AfterViewInit, OnDestroy {

    // @ViewChild('elfinder') elfinderDiv!: ElementRef;

    // @ViewChild('viewer') viewerContainer: ElementRef;

    // viewer: any;
    // options: any;

    page = {}

    files: TreeNode[];
    products: any[];

    criteria: any[];

    constructor() { }

    ngOnInit(): void {

        // this.page.svf = {
        //     "id": 6,
        //     "name": "SL_OM_IN(整合)_A棟.nwd", 
        //     "filePath": "./uploads/SL_OM_IN(%E6%95%B4%E5%90%88)_A%E6%A3%9F.nwd", 
        //     // "svfPath": "downloads/dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Ym1tc19vc3MvU0xfT01fSU4oJUU2JTk1JUI0JUU1JTkwJTg4KV9BJUU2JUEzJTlGLm53ZA/4755652b-a8e4-4d79-b049-b9ee252c3efe"
        //     "svfPath":"assets/downloads/api/M3-SE/Resource/3D/66962af7-0ae4-4b15-ae0b-0dbba901a673-000c9ef2"
        //     // "svfPath":"assets/downloads/vscode/M3-SE/dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Ym1tc19vc3MvVDMtVFAwMS1UWDEtWFgtWFhYLU0zLVNFLTAwNzAwLTcwMDIucnZ0/407b931a-5787-573b-581d-5b899a978233"
        // }

        this.page = { "urn": "urn:dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Ym1tc19vc3NfMjUwMjEwMjIxMDQ1L1QzLVRQMDEtVFgxLVhYLVhYWC1NMy1FRS0wMDAwMS03MDAyLm53Yw" }


        this.files = [
            {
                key: '0',
                label: 'T3-TP01-TX1-XX-XXX-M3-EE-00001',
                data: 'Documents Folder',
                icon: 'pi pi-fw pi-file',
                children: [
                    {
                        key: '0-0',
                        label: '工程驗收紀錄資料夾',
                        data: 'Work Folder',
                        icon: 'pi pi-fw pi-file',
                        children: [
                            { key: '0-0-0', label: 'Expenses.doc', icon: 'pi pi-fw pi-file', data: 'Expenses Document' },
                            { key: '0-0-1', label: 'Resume.doc', icon: 'pi pi-fw pi-file', data: 'Resume Document' }
                        ]
                    },
                    {
                        key: '0-1',
                        label: '工程進度追蹤資料夾',
                        data: 'Home Folder',
                        icon: 'pi pi-fw pi-file',
                        children: [{ key: '0-1-0', label: 'Invoices.txt', icon: 'pi pi-fw pi-file', data: 'Invoices for this month' }]
                    },
                    {
                        key: '0-2',
                        label: '工程變更設計紀錄',
                        data: 'Home Folder',
                        icon: 'pi pi-fw pi-file',
                        children: [{ key: '0-1-0', label: 'Invoices.txt', icon: 'pi pi-fw pi-file', data: 'Invoices for this month' }]
                    },
                    {
                        key: '0-3',
                        label: '交付施工模型圖',
                        data: 'Home Folder',
                        icon: 'pi pi-fw pi-file',
                        children: [{ key: '0-1-0', label: 'T3-TP01-TX1-XX-XXX-M3-EE-00001.rvt', icon: 'pi pi-fw pi-file', data: 'Invoices for this month' }]
                    }
                ]
            },
            {
                key: '1',
                label: 'T3-TP11-TB1-XX-XXX-M6-EA-00091',
                data: 'Events Folder',
                icon: 'pi pi-fw pi-file',
                children: [
                    { key: '1-0', label: 'Meeting', icon: 'pi pi-fw pi-calendar-plus', data: 'Meeting' },
                    { key: '1-1', label: 'Product Launch', icon: 'pi pi-fw pi-calendar-plus', data: 'Product Launch' },
                    { key: '1-2', label: 'Report Review', icon: 'pi pi-fw pi-calendar-plus', data: 'Report Review' }
                ]
            },
            {
                key: '2',
                label: 'T3-TP14-TA2-XX-XXX-N6-AA-02011',
                data: 'Movies Folder',
                icon: 'pi pi-fw pi-file',
                children: [
                    {
                        key: '2-0',
                        icon: 'pi pi-fw pi-star-fill',
                        label: 'Al Pacino',
                        data: 'Pacino Movies',
                        children: [
                            { key: '2-0-0', label: 'Scarface', icon: 'pi pi-fw pi-video', data: 'Scarface Movie' },
                            { key: '2-0-1', label: 'Serpico', icon: 'pi pi-fw pi-video', data: 'Serpico Movie' }
                        ]
                    },
                    {
                        key: '2-1',
                        label: 'Robert De Niro',
                        icon: 'pi pi-fw pi-star-fill',
                        data: 'De Niro Movies',
                        children: [
                            { key: '2-1-0', label: 'Goodfellas', icon: 'pi pi-fw pi-video', data: 'Goodfellas Movie' },
                            { key: '2-1-1', label: 'Untouchables', icon: 'pi pi-fw pi-video', data: 'Untouchables Movie' }
                        ]
                    }
                ]
            }
        ];

        this.products = [
            {
                id: '1000',
                code: 'T3-TP20-TA-EE-f230fh0g3',
                name: '旅客電梯',
                description: 'Product Description',
                image: 'bamboo-watch.jpg',
                price: 65,
                category: '電梯設備',
                quantity: 24,
                inventoryStatus: '1F',
                rating: 5
            },
            {
                id: '1001',
                code: 'T3-TP20-TA-EE-AA-BB',
                name: '手扶梯',
                description: 'Product Description',
                image: 'black-watch.jpg',
                price: 72,
                category: '電梯設備',
                quantity: 61,
                inventoryStatus: '2F',
                rating: 4
            },
            {
                id: '1002',
                code: 'T3-TP20-TA-EE-AA-BB',
                name: '貨梯',
                description: 'Product Description',
                image: 'blue-band.jpg',
                price: 79,
                category: '電梯設備',
                quantity: 2,
                inventoryStatus: 'RF',
                rating: 3
            },
            {
                id: '1003',
                code: 'T3-TP20-TA-EE-AA-BB',
                name: '旅客電梯',
                description: 'Product Description',
                image: 'blue-t-shirt.jpg',
                price: 29,
                category: '電梯設備',
                quantity: 25,
                inventoryStatus: 'B1',
                rating: 5
            },
            {
                id: '1004',
                code: 'T3-TP20-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'bracelet.jpg',
                price: 15,
                category: '電梯設備',
                quantity: 73,
                inventoryStatus: 'B2',
                rating: 4
            },
            {
                id: '1005',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1006',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1007',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1008',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1009',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1010',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1011',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1012',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1013',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1014',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1015',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1016',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1017',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1018',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1019',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1020',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1021',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1022',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1023',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1024',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1025',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1026',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1027',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1028',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            },
            {
                id: '1029',
                code: 'T3-TP01-TA-EE-AA-BB',
                name: '行李貨梯',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: '電梯設備',
                quantity: 0,
                inventoryStatus: 'B3',
                rating: 4
            }
        ];

        this.criteria = [
            {
                field: '空間區域名稱',
                collapse: false,
                items: [
                    { name: '旅客大廳', selected: false },
                    { name: '走廊', selected: false },
                    { name: '辦公區', selected: false },
                    { name: '停車場', selected: false },
                    { name: '接待區', selected: false },
                    { name: '道路', selected: false },
                    { name: '旅客大廳', selected: false },
                    { name: '捷運聯絡道', selected: false },
                    { name: 'T#辦公區', selected: false },
                    { name: 'A區停車場', selected: false },
                    { name: '接機停等區', selected: false },
                    { name: '聯外道路', selected: false },
                    { name: '男廁', selected: false },
                    { name: 'A1座位區', selected: false },
                    { name: '女廁', selected: false },
                    { name: 'B1座位區', selected: false },
                    { name: '航空公司櫃台', selected: false },
                    { name: '旅客電梯', selected: false },
                    { name: '貨梯', selected: false }]
            },
            {
                field: '樓層名稱',
                collapse: false,
                items: [
                    { name: 'B4', selected: false },
                    { name: 'B3', selected: false },
                    { name: 'B2', selected: false },
                    { name: 'B1', selected: false },
                    { name: '1F', selected: false },
                    { name: '2F', selected: false },
                    { name: '3F', selected: false },
                    { name: '4F', selected: false },
                    { name: '5F', selected: false },
                    { name: '6F', selected: false },
                    { name: '7F', selected: false },
                    { name: '8F', selected: false },
                    { name: 'RF', selected: false }]
            },
            {
                field: '管理系統分類',
                collapse: false,
                items: [
                    { name: '空調系統', selected: false },
                    { name: '空橋設備', selected: false },
                    { name: '電梯設備', selected: false },
                    { name: '天然氣管線', selected: false },
                    { name: '消防管線', selected: false },
                    { name: '汙水系統', selected: false },
                    { name: '焚化爐系統', selected: false },
                    { name: '電力系統', selected: false },
                    { name: 'BHS系統', selected: false },
                    { name: 'PMS營運系統', selected: false },
                    { name: '空調系統', selected: false },
                    { name: '空橋設備', selected: false },
                    { name: '電梯設備', selected: false },
                    { name: '天然氣管線', selected: false },
                    { name: '消防管線', selected: false },
                    { name: '汙水系統', selected: false },
                    { name: '焚化爐系統', selected: false },
                    { name: '電力系統', selected: false },
                    { name: 'BHS系統', selected: false },
                    { name: 'PMS營運系統', selected: false },
                    { name: '跑道', selected: false }]
            },
            {
                field: '構件類型',
                collapse: false,
                items: [
                    { name: '建築工程', selected: false },
                    { name: '結構工程', selected: false },
                    { name: '照明設備', selected: false },
                    { name: '瓦斯天然氣管線', selected: false },
                    { name: '給水管線', selected: false },
                    { name: '排水管線', selected: false },
                    { name: '汙水管線', selected: false },
                    { name: '消防管線', selected: false },
                    { name: '消防設備', selected: false },
                    { name: '電力線架', selected: false },
                    { name: '電力設備', selected: false },
                    { name: '弱電槽線', selected: false },
                    { name: '照明設備', selected: false },
                    { name: '瓦斯管線', selected: false },
                    { name: '給水管線', selected: false },
                    { name: '排水管線', selected: false },
                    { name: '汙水管線', selected: false },
                    { name: '消防管線', selected: false },
                    { name: '消防設備', selected: false },
                    { name: '電力線架', selected: false },
                    { name: '電力設備', selected: false },
                    { name: '弱電槽線', selected: false },
                    { name: '弱電設備', selected: false },
                    { name: '油管監控', selected: false },
                    { name: '機場油管', selected: false }]
            }
        ];

    }

    ngAfterViewInit(): void {
        // $(this.elfinderDiv.nativeElement).elfinder({
        //     cssAutoLoad: false,               // Disable CSS auto loading
        //     baseUrl: './elfinder/',
        //     url: `${endpoint}/elfinder/php/connector.minimal.php`,  // connector URL (REQUIRED)
        //     // lang: 'ru'                    // language (OPTIONAL)
        //     height: '480px',            
        // }, (fm: any) => {
        //     // `init` event callback function
        //     fm.bind('init', function () { });
        //     // Optional for set document.title dynamically.
        //     var title = document.title;
        //     fm.bind('open', function () {
        //         var path = '',
        //             cwd = fm.cwd();
        //         if (cwd) {
        //             path = fm.path(cwd.hash) || null;
        //         }
        //         document.title = path ? path + ':' + title : title;
        //     }).bind('destroy', function () {
        //         document.title = title;
        //     });
        // });
    }

    ngOnDestroy(): void { }

}
