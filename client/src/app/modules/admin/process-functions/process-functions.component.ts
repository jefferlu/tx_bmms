import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterOutlet } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { environment } from 'environments/environment';
import { TreeNode } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { TreeModule } from 'primeng/tree';
import { SearchPanelComponent } from './search-panel/search-panel.component';
import { JsonPipe } from '@angular/common';

declare const Autodesk: any;
const env = environment;

@Component({
    selector: 'app-process-functions',
    templateUrl: './process-functions.component.html',
    styleUrl: './process-functions.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        RouterOutlet, JsonPipe,
        MatButtonModule, MatIconModule,
        TreeModule, TableModule,
        TranslocoModule,
        SearchPanelComponent
    ],

})
export class ProcessFunctionsComponent implements OnInit {

    viewer: any;
    options: any;

    files: TreeNode[];
    products: any[];

    criteria: any[];

    constructor() { }

    ngOnInit(): void {
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
                code: 'f230fh0g3',
                name: 'Bamboo Watch',
                description: 'Product Description',
                image: 'bamboo-watch.jpg',
                price: 65,
                category: 'Accessories',
                quantity: 24,
                inventoryStatus: 'INSTOCK',
                rating: 5
            },
            {
                id: '1001',
                code: 'nvklal433',
                name: 'Black Watch',
                description: 'Product Description',
                image: 'black-watch.jpg',
                price: 72,
                category: 'Accessories',
                quantity: 61,
                inventoryStatus: 'OUTOFSTOCK',
                rating: 4
            },
            {
                id: '1002',
                code: 'zz21cz3c1',
                name: 'Blue Band',
                description: 'Product Description',
                image: 'blue-band.jpg',
                price: 79,
                category: 'Fitness',
                quantity: 2,
                inventoryStatus: 'LOWSTOCK',
                rating: 3
            },
            {
                id: '1003',
                code: '244wgerg2',
                name: 'Blue T-Shirt',
                description: 'Product Description',
                image: 'blue-t-shirt.jpg',
                price: 29,
                category: 'Clothing',
                quantity: 25,
                inventoryStatus: 'INSTOCK',
                rating: 5
            },
            {
                id: '1004',
                code: 'h456wer53',
                name: 'Bracelet',
                description: 'Product Description',
                image: 'bracelet.jpg',
                price: 15,
                category: 'Accessories',
                quantity: 73,
                inventoryStatus: 'INSTOCK',
                rating: 4
            },
            {
                id: '1005',
                code: 'av2231fwg',
                name: 'Brown Purse',
                description: 'Product Description',
                image: 'brown-purse.jpg',
                price: 120,
                category: 'Accessories',
                quantity: 0,
                inventoryStatus: 'OUTOFSTOCK',
                rating: 4
            },
            {
                id: '1006',
                code: 'bib36pfvm',
                name: 'Chakra Bracelet',
                description: 'Product Description',
                image: 'chakra-bracelet.jpg',
                price: 32,
                category: 'Accessories',
                quantity: 5,
                inventoryStatus: 'LOWSTOCK',
                rating: 3
            },
            {
                id: '1007',
                code: 'mbvjkgip5',
                name: 'Galaxy Earrings',
                description: 'Product Description',
                image: 'galaxy-earrings.jpg',
                price: 34,
                category: 'Accessories',
                quantity: 23,
                inventoryStatus: 'INSTOCK',
                rating: 5
            },
            {
                id: '1008',
                code: 'vbb124btr',
                name: 'Game Controller',
                description: 'Product Description',
                image: 'game-controller.jpg',
                price: 99,
                category: 'Electronics',
                quantity: 2,
                inventoryStatus: 'LOWSTOCK',
                rating: 4
            },
            {
                id: '1009',
                code: 'cm230f032',
                name: 'Gaming Set',
                description: 'Product Description',
                image: 'gaming-set.jpg',
                price: 299,
                category: 'Electronics',
                quantity: 63,
                inventoryStatus: 'INSTOCK',
                rating: 3
            },
            {
                id: '1010',
                code: 'plb34234v',
                name: 'Gold Phone Case',
                description: 'Product Description',
                image: 'gold-phone-case.jpg',
                price: 24,
                category: 'Accessories',
                quantity: 0,
                inventoryStatus: 'OUTOFSTOCK',
                rating: 4
            },
            {
                id: '1011',
                code: '4920nnc2d',
                name: 'Green Earbuds',
                description: 'Product Description',
                image: 'green-earbuds.jpg',
                price: 89,
                category: 'Electronics',
                quantity: 23,
                inventoryStatus: 'INSTOCK',
                rating: 4
            },
            {
                id: '1012',
                code: '250vm23cc',
                name: 'Green T-Shirt',
                description: 'Product Description',
                image: 'green-t-shirt.jpg',
                price: 49,
                category: 'Clothing',
                quantity: 74,
                inventoryStatus: 'INSTOCK',
                rating: 5
            },
            {
                id: '1013',
                code: 'fldsmn31b',
                name: 'Grey T-Shirt',
                description: 'Product Description',
                image: 'grey-t-shirt.jpg',
                price: 48,
                category: 'Clothing',
                quantity: 0,
                inventoryStatus: 'OUTOFSTOCK',
                rating: 3
            },
            {
                id: '1014',
                code: 'waas1x2as',
                name: 'Headphones',
                description: 'Product Description',
                image: 'headphones.jpg',
                price: 175,
                category: 'Electronics',
                quantity: 8,
                inventoryStatus: 'LOWSTOCK',
                rating: 5
            },
            {
                id: '1015',
                code: 'vb34btbg5',
                name: 'Light Green T-Shirt',
                description: 'Product Description',
                image: 'light-green-t-shirt.jpg',
                price: 49,
                category: 'Clothing',
                quantity: 34,
                inventoryStatus: 'INSTOCK',
                rating: 4
            },
            {
                id: '1016',
                code: 'k8l6j58jl',
                name: 'Lime Band',
                description: 'Product Description',
                image: 'lime-band.jpg',
                price: 79,
                category: 'Fitness',
                quantity: 12,
                inventoryStatus: 'INSTOCK',
                rating: 3
            },
            {
                id: '1017',
                code: 'v435nn85n',
                name: 'Mini Speakers',
                description: 'Product Description',
                image: 'mini-speakers.jpg',
                price: 85,
                category: 'Clothing',
                quantity: 42,
                inventoryStatus: 'INSTOCK',
                rating: 4
            },
            {
                id: '1018',
                code: '09zx9c0zc',
                name: 'Painted Phone Case',
                description: 'Product Description',
                image: 'painted-phone-case.jpg',
                price: 56,
                category: 'Accessories',
                quantity: 41,
                inventoryStatus: 'INSTOCK',
                rating: 5
            },
            {
                id: '1019',
                code: 'mnb5mb2m5',
                name: 'Pink Band',
                description: 'Product Description',
                image: 'pink-band.jpg',
                price: 79,
                category: 'Fitness',
                quantity: 63,
                inventoryStatus: 'INSTOCK',
                rating: 4
            },
            {
                id: '1020',
                code: 'r23fwf2w3',
                name: 'Pink Purse',
                description: 'Product Description',
                image: 'pink-purse.jpg',
                price: 110,
                category: 'Accessories',
                quantity: 0,
                inventoryStatus: 'OUTOFSTOCK',
                rating: 4
            },
            {
                id: '1021',
                code: 'pxpzczo23',
                name: 'Purple Band',
                description: 'Product Description',
                image: 'purple-band.jpg',
                price: 79,
                category: 'Fitness',
                quantity: 6,
                inventoryStatus: 'LOWSTOCK',
                rating: 3
            },
            {
                id: '1022',
                code: '2c42cb5cb',
                name: 'Purple Gemstone Necklace',
                description: 'Product Description',
                image: 'purple-gemstone-necklace.jpg',
                price: 45,
                category: 'Accessories',
                quantity: 62,
                inventoryStatus: 'INSTOCK',
                rating: 4
            },
            {
                id: '1023',
                code: '5k43kkk23',
                name: 'Purple T-Shirt',
                description: 'Product Description',
                image: 'purple-t-shirt.jpg',
                price: 49,
                category: 'Clothing',
                quantity: 2,
                inventoryStatus: 'LOWSTOCK',
                rating: 5
            },
            {
                id: '1024',
                code: 'lm2tny2k4',
                name: 'Shoes',
                description: 'Product Description',
                image: 'shoes.jpg',
                price: 64,
                category: 'Clothing',
                quantity: 0,
                inventoryStatus: 'INSTOCK',
                rating: 4
            },
            {
                id: '1025',
                code: 'nbm5mv45n',
                name: 'Sneakers',
                description: 'Product Description',
                image: 'sneakers.jpg',
                price: 78,
                category: 'Clothing',
                quantity: 52,
                inventoryStatus: 'INSTOCK',
                rating: 4
            },
            {
                id: '1026',
                code: 'zx23zc42c',
                name: 'Teal T-Shirt',
                description: 'Product Description',
                image: 'teal-t-shirt.jpg',
                price: 49,
                category: 'Clothing',
                quantity: 3,
                inventoryStatus: 'LOWSTOCK',
                rating: 3
            },
            {
                id: '1027',
                code: 'acvx872gc',
                name: 'Yellow Earbuds',
                description: 'Product Description',
                image: 'yellow-earbuds.jpg',
                price: 89,
                category: 'Electronics',
                quantity: 35,
                inventoryStatus: 'INSTOCK',
                rating: 3
            },
            {
                id: '1028',
                code: 'tx125ck42',
                name: 'Yoga Mat',
                description: 'Product Description',
                image: 'yoga-mat.jpg',
                price: 20,
                category: 'Fitness',
                quantity: 15,
                inventoryStatus: 'INSTOCK',
                rating: 5
            },
            {
                id: '1029',
                code: 'gwuby345v',
                name: 'Yoga Set',
                description: 'Product Description',
                image: 'yoga-set.jpg',
                price: 20,
                category: 'Fitness',
                quantity: 25,
                inventoryStatus: 'INSTOCK',
                rating: 8
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

    onHeaderClick(event: any) {
        // event.stopPropagation();
        // 阻止默认的展开行为
        console.log('header click', event.originalEvent, event.index)
        event.originalEvent.stopPropagation();
    }



    ngAfterViewInit(): void {
        console.log(this.criteria)
        const container = document.getElementById('viewer');
        this.viewer = new Autodesk.Viewing.Private.GuiViewer3D(container);
        // let svfPath = res.svfPath.replace(/\\/g, '/');
        // console.log(`${env.downloadUrl}${svfPath}/output.svf`)
        // this.options = {
        //     env: 'Local',
        //     useConsolidation: true,
        //     document: `${env.downloadUrl}${svfPath}/output.svf`,
        //     language: 'en'
        // };
        let res = {
            "id": 6,
            "name": "SL_OM_IN(整合)_A棟.nwd",
            "filePath": "./uploads/SL_OM_IN(%E6%95%B4%E5%90%88)_A%E6%A3%9F.nwd",
            "svfPath": "downloads/dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Ym1tc19vc3MvU0xfT01fSU4oJUU2JTk1JUI0JUU1JTkwJTg4KV9BJUU2JUEzJTlGLm53ZA/4755652b-a8e4-4d79-b049-b9ee252c3efe"
        }

        let svfPath = res.svfPath.replace(/\\/g, '/');
        console.log(`${env.downloadUrl}${svfPath}/output.svf`)
        this.options = {
            env: 'Local',
            useConsolidation: true,
            document: `${svfPath}/output.svf`,
            language: 'en',
            background: {
                color: [0, 0, 0], // 背景顏色，這裡設置為黑色
                gradient: 'none', // 背景漸變效果，這裡設置為無
                opacity: 0 // 背景透明度，這裡設置為完全透明
            }
        };
        Autodesk.Viewing.Initializer(this.options, () => {
            Autodesk.Viewing.Private.InitParametersSetting.alpha = true;
            const startedCode = this.viewer.start(this.options.document, this.options, () => {
                this.viewer.impl.renderer().setClearAlpha(0);
                this.viewer.impl.glrenderer().setClearColor(0xffffff, 0);
                this.viewer.impl.invalidate(true);
                console.log('check')
            });
        });
    }


}
