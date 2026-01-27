import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { TranslocoModule, TranslocoService, TranslocoEvents } from '@jsverse/transloco';
import { Subject, takeUntil, merge } from 'rxjs';
import { filter, map, distinctUntilChanged } from 'rxjs/operators';
import { environment } from 'environments/environment';
import { AuthService } from 'app/core/auth/auth.service';
import { BreadcrumbService } from 'app/core/services/breadcrumb/breadcrumb.service';

declare var $: any;
const endpoint = environment.elfinder;

@Component({
    selector: 'app-bim-media-viewer',
    templateUrl: './bim-media-viewer.component.html',
    styleUrl: './bim-media-viewer.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TranslocoModule]
})
export class BimMediaViewerComponent implements OnInit, OnDestroy {

    @ViewChild('elfinder') elfinderDiv!: ElementRef;

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    lang: any;

    constructor(
        private _translocoService: TranslocoService,
        private _authService: AuthService,
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
