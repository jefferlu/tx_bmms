import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { NgClass, NgFor, NgSwitch, NgSwitchCase } from '@angular/common';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subject } from 'rxjs';
import { TranslocoModule } from '@jsverse/transloco';
import { BackupRestoreComponent } from './backup-restore/backup-restore.component';
import { LogQueryComponent} from './log-query/log-query.component';


@Component({
    selector: 'app-system-administration',
    templateUrl: './system-administration.component.html',
    styleUrl: './system-administration.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        NgFor, NgClass, NgSwitch, NgSwitchCase,
        MatSidenavModule, MatButtonModule, MatIconModule,
        TranslocoModule, BackupRestoreComponent,LogQueryComponent
    ],
})
export class SystemAdministrationComponent implements OnInit, OnDestroy {
    @ViewChild('drawer') drawer: MatDrawer;
    drawerMode: 'over' | 'side' = 'side';
    drawerOpened: boolean = true;
    panels: any[] = [];
    selectedPanel: string = 'backup-restore';
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    ngOnInit(): void {
        // Setup available panels
        this.panels = [            
            {
                id: 'backup-restore',
                icon: 'heroicons_outline:lock-closed',
                title: '資料庫備份&還原',
                // description: 'Manage your password and 2-step verification preferences',
            },
            {
                id: 'system-log-query',
                icon: 'heroicons_outline:lock-closed',
                title: '系統日誌'
            },
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
