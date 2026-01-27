import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { MenuItem } from 'primeng/api';
import { Subject, takeUntil } from 'rxjs';
import { environment } from 'environments/environment';
import { AuthService } from 'app/core/auth/auth.service';

declare var $: any;
const endpoint = environment.elfinder;

@Component({
    selector: 'app-bim-media-viewer',
    templateUrl: './bim-media-viewer.component.html',
    styleUrl: './bim-media-viewer.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TranslocoModule, BreadcrumbModule]
})
export class BimMediaViewerComponent implements OnInit, OnDestroy {

    @ViewChild('elfinder') elfinderDiv!: ElementRef;

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    lang: any;
    breadcrumbItems: MenuItem[] = [];
    homeBreadcrumbItem: MenuItem = {};

    constructor(
        private _translocoService: TranslocoService,
        private _authService: AuthService
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
    }

    ngAfterViewInit(): void {

        this.lang = this.getViewerLanguage(this._translocoService.getActiveLang());

        $(this.elfinderDiv.nativeElement).elfinder({
            cssAutoLoad: false,               // Disable CSS auto loading
            baseUrl: './elfinder/',
            url: `${endpoint}/elfinder/php/connector.minimal.php`,  // connector URL (REQUIRED)
            lang: this.lang,                // language (OPTIONAL)
            height: 'auto',
            width: '100%',
            customHeaders: {
                'Authorization': `Bearer ${this._authService.accessToken}`
            }
        }, (fm: any) => {
            // `init` event callback function
            fm.bind('init', function () { });
            // Optional for set document.title dynamically.
            var title = document.title;
            fm.bind('open', function () {
                var path = '',
                    cwd = fm.cwd();
                if (cwd) {
                    path = fm.path(cwd.hash) || null;
                }
                document.title = path ? path + ':' + title : title;
            }).bind('destroy', function () {
                document.title = title;
            });
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
                label: this._translocoService.translate('digital-files')
            }
        ];
    }

    private getViewerLanguage(lang: string): string {
        switch (lang) {
            case 'zh':
                return 'zh_TW';  // Fixed: use underscore to match actual file name
            case 'en':
            default:  // 默認為英文
                return 'en';
        }
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
