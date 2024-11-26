import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { NgClass, NgFor, NgSwitch, NgSwitchCase } from '@angular/common';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil } from 'rxjs';
import { UserAccountComponent } from './user-account/user-account.component';
import { RoleListComponent } from './role-list/role-list.component';
import { LogQueryComponent} from './log-query/log-query.component';
import { TranslocoModule } from '@jsverse/transloco';
import { GtsMediaWatcherService } from '@gts/services/media-watcher';

@Component({
    selector: 'app-user-management',
    templateUrl: './user-management.component.html',
    styleUrl: './user-management.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        NgFor, NgClass, NgSwitch, NgSwitchCase, TranslocoModule,
        MatSidenavModule, MatButtonModule, MatIconModule,
        UserAccountComponent, RoleListComponent, LogQueryComponent
    ],
})
export class UserManagementComponent implements OnInit, OnDestroy {

    @ViewChild('drawer') drawer: MatDrawer;
    drawerMode: 'over' | 'side' = 'side';
    drawerOpened: boolean = true;
    panels: any[] = [];
    selectedPanel: string = 'user-account';
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _gtsMediaWatcherService: GtsMediaWatcherService
    ) { }

    ngOnInit(): void {

        // Setup available panels
        this.panels = [
            {
                id: 'user-account',
                icon: 'heroicons_outline:user-circle',
                title: '帳戶管理'
            },
            // {
            //     id: 'role-group',
            //     icon: 'heroicons_outline:user-group',
            //     title: '權限管理'
            // },
            {
                id: 'log-query',
                icon: 'heroicons_outline:lock-closed',
                title: '紀錄查詢'
            },
            {
                id: 'role-list',
                icon: 'heroicons_outline:check-circle',
                title: '權限設定'
            }
        ];

        // Subscribe to media changes
        this._gtsMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                // Set the drawerMode and drawerOpened
                if (matchingAliases.includes('lg')) {
                    this.drawerMode = 'side';
                    this.drawerOpened = true;
                } else {
                    this.drawerMode = 'over';
                    this.drawerOpened = false;
                }

                // Mark for check
                this._changeDetectorRef.markForCheck();
            });
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
