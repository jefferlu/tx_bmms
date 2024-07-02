import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from 'environments/environment';
import { TreeNode } from 'primeng/api';
import { TreeModule } from 'primeng/tree';

declare const Autodesk: any;
const env = environment;

@Component({
    selector: 'app-process-functions',
    templateUrl: './process-functions.component.html',
    styleUrl: './process-functions.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [RouterOutlet, TreeModule],

})
export class ProcessFunctionsComponent implements OnInit {

    viewer: any;
    options: any;

    files: TreeNode[];

    constructor() { }

    ngOnInit(): void {
        this.files = [
            {
                key: '0',
                label: 'Documents',
                data: 'Documents Folder',
                icon: 'pi pi-fw pi-inbox',
                children: [
                    {
                        key: '0-0',
                        label: 'Work',
                        data: 'Work Folder',
                        icon: 'pi pi-fw pi-cog',
                        children: [
                            { key: '0-0-0', label: 'Expenses.doc', icon: 'pi pi-fw pi-file', data: 'Expenses Document' },
                            { key: '0-0-1', label: 'Resume.doc', icon: 'pi pi-fw pi-file', data: 'Resume Document' }
                        ]
                    },
                    {
                        key: '0-1',
                        label: 'Home',
                        data: 'Home Folder',
                        icon: 'pi pi-fw pi-home',
                        children: [{ key: '0-1-0', label: 'Invoices.txt', icon: 'pi pi-fw pi-file', data: 'Invoices for this month' }]
                    }
                ]
            },
            {
                key: '1',
                label: 'Events',
                data: 'Events Folder',
                icon: 'pi pi-fw pi-calendar',
                children: [
                    { key: '1-0', label: 'Meeting', icon: 'pi pi-fw pi-calendar-plus', data: 'Meeting' },
                    { key: '1-1', label: 'Product Launch', icon: 'pi pi-fw pi-calendar-plus', data: 'Product Launch' },
                    { key: '1-2', label: 'Report Review', icon: 'pi pi-fw pi-calendar-plus', data: 'Report Review' }
                ]
            },
            {
                key: '2',
                label: 'Movies',
                data: 'Movies Folder',
                icon: 'pi pi-fw pi-star-fill',
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


    }



    ngAfterViewInit(): void {
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
