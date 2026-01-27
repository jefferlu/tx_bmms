import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';;
import { GtsAlertComponent } from '@gts/components/alert';
import { TranslocoModule, TranslocoService, TranslocoEvents } from '@jsverse/transloco';
import { BackupRestoreService } from './backup-restore.service';
import { BreadcrumbService } from 'app/core/services/breadcrumb/breadcrumb.service';
import { filter, map, distinctUntilChanged } from 'rxjs/operators';
import { map, Subject, Subscription, takeUntil, merge } from 'rxjs';
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

        // 同時監聽語系切換和翻譯文件加載完成事件
        // langChanges$: 當用戶切換語系時立即更新
        // translationLoadSuccess: 當翻譯文件首次加載完成時更新
        merge(
            this._translocoService.langChanges$,
            this._translocoService.events$.pipe(
                filter(e => e.type === 'translationLoadSuccess'),
                map(() => this._translocoService.getActiveLang())
            )
        ).pipe(
            distinctUntilChanged(),
            takeUntil(this._unsubscribeAll)
        ).subscribe(() => {
            this.updateBreadcrumb();
        });
