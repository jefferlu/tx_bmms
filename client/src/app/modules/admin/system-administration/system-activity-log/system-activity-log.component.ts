import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { RadioButtonModule } from 'primeng/radiobutton';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { MenuItem } from 'primeng/api';
import { Subject, takeUntil } from 'rxjs';
import { SystemActivityLogService } from './system-activity-log.service';

const LINES = 500;

@Component({
    selector: 'app-system-activity-log',
    templateUrl: './system-activity-log.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule, TranslocoModule,
        ScrollPanelModule, RadioButtonModule,
        MatIconModule, MatButtonModule, MatInputModule, BreadcrumbModule
    ],

})
export class SystemActivityLogComponent {

    private _unsubscribeAll: Subject<any> = new Subject<any>();
    data: any;
    container: string = 'bmms_client';
    breadcrumbItems: MenuItem[] = [];
    homeBreadcrumbItem: MenuItem = {};

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _translocoService: TranslocoService,
        private _systemActivityLogService: SystemActivityLogService
    ) { }

    ngOnInit(): void {
        // 初始化 breadcrumb
        this.initBreadcrumb();

        // 監聽語系變化以更新 breadcrumb
        this._translocoService.langChanges$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => {
                this.initBreadcrumb();
            });

        // Get groups data
        this._systemActivityLogService.getData(this.container, { lines: LINES })
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((data: any) => {
                this.data = data;
                this._changeDetectorRef.markForCheck();
            });
    }

    onClick(container): void {
        // Get groups data
        this._systemActivityLogService.getData(container, { lines: LINES })
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((data: any) => {
                this.data = data;
                this._changeDetectorRef.markForCheck();
            });
    }

    // 初始化 breadcrumb
    initBreadcrumb(): void {
        this.homeBreadcrumbItem = {
            icon: 'pi pi-home',
            routerLink: '/'
        };

        this.breadcrumbItems = [
            {
                label: this._translocoService.translate('system-administration')
            },
            {
                label: this._translocoService.translate('system-log-query')
            }
        ];
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
