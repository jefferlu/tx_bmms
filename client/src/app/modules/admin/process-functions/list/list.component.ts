import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { InventoryProduct } from '../process-functions.type';
import { MatDialog } from '@angular/material/dialog';
import { ProcessFunctionsService } from '../process-functions.service';
import { Observable } from 'rxjs';
import { SearchComponent } from '../search/search.component';
import { ChipsearchComponent } from '../chipsearch/chipsearch.component';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { RouterLink, RouterOutlet } from '@angular/router';
import { environment } from 'environments/environment';
import { TranslocoModule } from '@jsverse/transloco';

declare const Autodesk: any;
const env = environment;

@Component({
    selector: 'app-list',
    templateUrl: './list.component.html',
    styleUrl: './list.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        NgIf, NgFor, RouterOutlet, RouterLink,
        MatSidenavModule, MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule, MatSortModule, MatCheckboxModule, MatPaginatorModule,
        TranslocoModule, AsyncPipe],
})
export class ListComponent implements OnInit, OnDestroy {

    @ViewChild('matDrawer', { static: true }) matDrawer: MatDrawer;

    @ViewChild(MatPaginator) private _paginator: MatPaginator;
    @ViewChild(MatSort) private _sort: MatSort;

    products$: Observable<InventoryProduct[]>;

    viewer: any;
    options: any;

    constructor(
        private _matDialog: MatDialog,
        private _inventoryService: ProcessFunctionsService,
    ) {

    }

    ngOnInit(): void {

        const container = document.getElementById('viewer');

        // Get the products
        this.products$ = this._inventoryService.products$;

        this.products$.subscribe({
            next: (res) => {
                // console.log(res)
            },
            error: e => { }
        })

    }

    ngAfterViewInit(): void {
        console.log(this._sort, this._paginator)
        if (this._sort && this._paginator) {

        }
    }

    advanceSearch(): void {
        this._matDialog.open(SearchComponent, {
            autoFocus: false,
            data: {
                note: {},
            },
        });
    }

    chipSearch(): void {
        this._matDialog.open(ChipsearchComponent, {
            autoFocus: false,
            data: {
                note: {},
            },
        });
    }

    toggle(item: any, change: MatCheckboxChange): void {
        this.matDrawer.open();
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

    close(): void {
        this.matDrawer.close();
        if (this.viewer) {
            this.viewer.finish();
        }
    }

    /**
     * Track by function for ngFor loops
     *
     * @param index
     * @param item
     */
    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    ngOnDestroy(): void {
        if (this.viewer) {
            this.viewer.finish();
        }
    }
}

