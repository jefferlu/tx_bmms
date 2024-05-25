import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NgClass, NgFor, NgSwitch, NgSwitchCase } from '@angular/common';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subject } from 'rxjs';
import { SettingsAccountComponent } from './account/account.component';

@Component({
    selector: 'app-setup',
    templateUrl: './setup.component.html',
    styleUrl: './setup.component.scss',
    standalone: true,
    imports: [MatSidenavModule, MatButtonModule, MatIconModule, NgFor, NgClass, NgSwitch, NgSwitchCase, SettingsAccountComponent],
})
export class SetupComponent implements OnInit, OnDestroy {

    @ViewChild('drawer') drawer: MatDrawer;
    drawerMode: 'over' | 'side' = 'side';
    drawerOpened: boolean = true;
    panels: any[] = [];
    selectedPanel: string = 'account';
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    ngOnInit(): void {
        // Setup available panels
        this.panels = [
            {
                id: 'account',
                icon: 'heroicons_outline:user-circle',
                title: 'APS帳號及憑證',
                description: '客戶端 ID 和客戶端金鑰用於取得存取令牌，您必須使用這些令牌對 API 呼叫進行身份驗證。',
            },           
            {
                id: 'db_backup_restore',
                icon: 'heroicons_outline:lock-closed',
                title: '資料庫備份&還原',
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
