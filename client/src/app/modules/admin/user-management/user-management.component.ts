import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { NgClass, NgFor, NgSwitch, NgSwitchCase } from '@angular/common';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subject } from 'rxjs';
import { UserAccountComponent } from './user-account/user-account.component';


@Component({
    selector: 'app-user-management',
    templateUrl: './user-management.component.html',
    styleUrl: './user-management.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatSidenavModule, MatButtonModule, MatIconModule, NgFor, NgClass, NgSwitch, NgSwitchCase, UserAccountComponent],
})
export class UserManagementComponent implements OnInit, OnDestroy {

    @ViewChild('drawer') drawer: MatDrawer;
    drawerMode: 'over' | 'side' = 'side';
    drawerOpened: boolean = true;
    panels: any[] = [];
    selectedPanel: string = 'user-account';
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    ngOnInit(): void {
        // Setup available panels
        this.panels = [
            {
                id: 'user-account',
                icon: 'heroicons_outline:user-circle',
                title: '使用者管理',
                description: '客戶端 ID 和客戶端金鑰用於取得存取令牌，您必須使用這些令牌對 API 呼叫進行身份驗證。',
            },
            {
                id: 'db_backup_restore',
                icon: 'heroicons_outline:lock-closed',
                title: '紀錄查詢',
                description: 'Manage your password and 2-step verification preferences',
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
        console.log(id)
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
