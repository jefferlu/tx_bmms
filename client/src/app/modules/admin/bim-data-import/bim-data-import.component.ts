import { NgFor } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { TranslocoModule } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import { UploadObjectComponent } from './upload-object/upload-object.component';
import { TranslateJobComponent } from './translate-job/translate-job.component';
import { ExtraMetadataComponent } from './extra-metadata/extra-metadata.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-bim-data-import',
    templateUrl: './bim-data-import.component.html',
    styleUrl: './bim-data-import.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        NgFor, TranslocoModule,
        MatSidenavModule, MatButtonModule, MatIconModule,
        UploadObjectComponent, TranslateJobComponent, ExtraMetadataComponent
    ],
})
export class BimDataImportComponent implements OnInit, OnDestroy {

    @ViewChild('drawer') drawer: MatDrawer;
    drawerMode: 'over' | 'side' = 'side';
    drawerOpened: boolean = true;
    panels: any[] = [];
    selectedPanel: string = 'upload-object';
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor() { }

    ngOnInit(): void {
        this.panels = [
            {
                id: 'upload-object',
                icon: 'heroicons_outline:cloud-arrow-up',
            },
            {
                id: 'translate-job',
                icon: 'heroicons_outline:arrow-path-rounded-square',
            },
            {
                id: 'extract-metadata',
                icon: 'heroicons_outline:arrows-up-down',
            }
        ];
    }

    goToPanel(panel: string): void {
        this.selectedPanel = panel;

        // Close the drawer on 'over' mode
        if (this.drawerMode === 'over') {
            this.drawer.close();
        }
    }

    getPanelInfo(id: string): any {
        return this.panels.find(panel => panel.id === id);
    }

    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    ngOnDestroy(): void { }
}
