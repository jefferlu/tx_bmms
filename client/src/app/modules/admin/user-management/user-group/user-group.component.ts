import { DatePipe, NgClass, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormsModule, NgForm, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { finalize, Subject, takeUntil, merge } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { TranslocoModule, TranslocoService, TranslocoEvents } from '@jsverse/transloco';
import { filter, map, distinctUntilChanged } from 'rxjs/operators';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { ToastService } from 'app/layout/common/toast/toast.service';
import { MultiSelectModule } from 'primeng/multiselect';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TableModule } from 'primeng/table';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

import { GtsMediaWatcherService } from '@gts/services/media-watcher';
import { GtsConfirmationService } from '@gts/services/confirmation';
import { GtsValidators } from '@gts/validators';
import { GtsMapByName } from '@gts/pipes/map-by-name.pipe';
import { PermissionService, UserGroupService } from './user-group.service';
import { BreadcrumbService } from 'app/core/services/breadcrumb/breadcrumb.service';

@Component({
    selector: 'app-user-group',
    templateUrl: './user-group.component.html',
    styleUrl: './user-group.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgTemplateOutlet, FormsModule, ReactiveFormsModule, ToggleSwitchModule,
        MatInputModule, MatIconModule, MatFormFieldModule, MatSelectModule, MatDividerModule,
        MatSidenavModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatCheckboxModule,
        MatProgressSpinnerModule, TranslocoModule, TableModule, MultiSelectModule
    ],
})
export class UserGroupComponent implements OnInit, OnDestroy {
    @ViewChild('matDrawer', { static: true }) matDrawer: MatDrawer;
    @ViewChild('ngForm') ngForm: NgForm;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    drawerMode: 'side' | 'over';

    form: any = {

    }

    page: any = {
        name: null,
        data: null,
        permissions: null,
        restruct: null,
        record: null,
    };

    isLoading: boolean;

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _formBuilder: UntypedFormBuilder,
        private _gtsMediaWatcherService: GtsMediaWatcherService,
        private _gtsConfirmationService: GtsConfirmationService,
        private _toastService: ToastService,
        private _translocoService: TranslocoService,
        private _userGroupService: UserGroupService,
        private _permissionService: PermissionService,
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
