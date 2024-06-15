import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { RouterOutlet } from '@angular/router';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { Subject, takeUntil } from 'rxjs';
import { UploadObjectComponent } from './upload-object/upload-object.component';
import { TranslateJobComponent } from './translate-job/translate-job.component';
import { ExtraMetadataComponent } from './extra-metadata/extra-metadata.component';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
    selector: 'app-file-manager',
    templateUrl: './file-manager.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CommonModule,
        TranslocoModule,
        MatSidenavModule, MatIconModule, MatButtonModule,
        UploadObjectComponent, TranslateJobComponent, ExtraMetadataComponent
    ],
})
export class FileManagerComponent implements OnInit, OnDestroy {

    @ViewChild('drawer') drawer: MatDrawer;
    drawerMode: 'over' | 'side' = 'side';
    drawerOpened: boolean = true;
    selectedPanel: string = 'upload-object';
    panels: any[] = [];

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _translocoService: TranslocoService,
        private _fuseMediaWatcherService: FuseMediaWatcherService,
    ) { }

    ngOnInit(): void {

        // Subscribe to media changes
        this._fuseMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                // Set the drawerMode and drawerOpened
                if (matchingAliases.includes('lg')) {
                    this.drawerMode = 'side';
                    this.drawerOpened = true;
                }
                else {
                    this.drawerMode = 'over';
                    this.drawerOpened = false;
                }

                // Mark for check
                this._changeDetectorRef.markForCheck();
            });


        this.panels = [
            {
                id: 'upload-object',
                icon: 'heroicons_outline:cloud-arrow-up',
                title: this._translocoService.translate('upload-object'),
            },
            {
                id: 'translate-job',
                icon: 'heroicons_outline:arrow-path-rounded-square',
                title: this._translocoService.translate('translate-job'),
            },
            {
                id: 'extract-metadata',
                icon: 'heroicons_outline:arrows-up-down',
                title: this._translocoService.translate('extract-metadata'),
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

    ngOnDestroy(): void {
        // Unsubscribe from all subscriptions
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

}
