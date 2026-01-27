import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';;
import { GtsAlertComponent } from '@gts/components/alert';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { BackupRestoreService } from './backup-restore.service';
import { BreadcrumbService } from 'app/core/services/breadcrumb/breadcrumb.service';
import { map, Subject, Subscription, takeUntil } from 'rxjs';
import { GtsConfirmationService } from '@gts/services/confirmation';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { WebsocketService } from 'app/core/services/websocket/websocket.service';
import { ScrollPanelModule } from 'primeng/scrollpanel';

@Component({
    selector: 'backup-restore',
    templateUrl: './backup-restore.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        TranslocoModule, NgClass, FormsModule,
        MatButtonModule, MatIconModule, MatRadioModule,
        GtsAlertComponent, ScrollPanelModule
    ]
})
export class BackupRestoreComponent implements OnInit, OnDestroy {

    private _unsubscribeAll: Subject<any> = new Subject<any>();
    private _subscription: Subscription = new Subscription();

    data: any;
    plan: string = 'backup';
    message: string = '';

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _translocoService: TranslocoService,
        private _toastService: ToastService,
        private _gtsConfirmationService: GtsConfirmationService,
        private _websocketService: WebsocketService,
        private _backupRestoreService: BackupRestoreService,
        private _breadcrumbService: BreadcrumbService
    ) { }

    ngOnInit(): void {
        // 初始化 breadcrumb
        this.updateBreadcrumb();

        // 監聽語系變化以更新 breadcrumb
        this._translocoService.langChanges$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => {
                this.updateBreadcrumb();
            });

        // Subscribe webSocket message
        this._websocketService.connect('database');
        this._subscription.add(
            this._websocketService.onMessage('database').subscribe({
                next: (res) => {

                    // res.name = decodeURIComponent(res.name);
                    // this.message += res.message + '\n';
                    this.message = res.message;
                    if (res.file) this.data.latest_backup = res.file;
                    this._changeDetectorRef.markForCheck();
                },
                error: (err) => console.error('WebSocket error:', err),
                complete: () => console.log('WebSocket connection closed.'),
            })
        );


        // Get latest backup filename
        this._backupRestoreService.getData('core/latest-backup')
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((data: any) => {
                this.data = data;
                this._changeDetectorRef.markForCheck();
            });

    }

    onClick(): void {

        const title = this._translocoService.translate('confirm-action');
        const message = this._translocoService.translate('confirm-execution');
        const executeLabel = this._translocoService.translate('start-execution');
        const cancelLabel = this._translocoService.translate('cancel');

        let dialogRef = this._gtsConfirmationService.open({
            title: title,
            message: message,
            icon: { color: 'warn' },
            actions: { confirm: { label: executeLabel, color: 'warn' }, cancel: { label: cancelLabel } }

        });

        dialogRef.afterClosed().subscribe(result => {
            if (result === 'confirmed') {
                this.execute();
                this._changeDetectorRef.markForCheck();
            }
        });
    }

    execute(): void {
        if (this.plan === 'backup') {
            // execute backup
            this._backupRestoreService.getData('core/db-backup')
                .pipe(takeUntil(this._unsubscribeAll))
                .subscribe((data: any) => { });
        }
        else {
            // execute restore
            this._backupRestoreService.getData('core/db-restore')
                .pipe(takeUntil(this._unsubscribeAll))
                .subscribe((data: any) => { });
        }


    }

    // 更新 breadcrumb
    private updateBreadcrumb(): void {
        this._breadcrumbService.setBreadcrumb([
            {
                label: this._translocoService.translate('system-administration')
            },
            {
                label: this._translocoService.translate('backup-restore')
            }
        ]);
    }

    ngOnDestroy(): void {
        this._breadcrumbService.clear();
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
        this._subscription.unsubscribe();
        this._websocketService.close('database');
    }
}
