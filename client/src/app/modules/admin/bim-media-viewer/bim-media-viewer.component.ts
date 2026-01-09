import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, ViewEncapsulation, OnDestroy } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { environment } from 'environments/environment';
import { AuthService } from 'app/core/auth/auth.service';
import { Subscription } from 'rxjs';

declare var $: any;
const endpoint = environment.elfinder;

@Component({
    selector: 'app-bim-media-viewer',
    templateUrl: './bim-media-viewer.component.html',
    styleUrl: './bim-media-viewer.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: []
})
export class BimMediaViewerComponent implements OnDestroy {

    @ViewChild('elfinder') elfinderDiv!: ElementRef;

    lang: any;
    private elfinderInstance: any;
    private langChangeSubscription?: Subscription;

    constructor(
        private _translocoService: TranslocoService,
        private _authService: AuthService
    ) { }
    ngAfterViewInit(): void {
        // Initialize elfinder
        this.initElFinder();

        // Subscribe to language changes for dynamic language switching
        this.langChangeSubscription = this._translocoService.langChanges$.subscribe(lang => {
            this.destroyElFinder();
            this.initElFinder();
        });
    }

    ngOnDestroy(): void {
        // Unsubscribe to prevent memory leaks
        if (this.langChangeSubscription) {
            this.langChangeSubscription.unsubscribe();
        }
        // Destroy elfinder instance
        this.destroyElFinder();
    }

    /**
     * Initialize elfinder instance
     */
    private initElFinder(): void {
        this.lang = this.getViewerLanguage(this._translocoService.getActiveLang());

        this.elfinderInstance = $(this.elfinderDiv.nativeElement).elfinder({
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

    /**
     * Destroy elfinder instance
     */
    private destroyElFinder(): void {
        if (this.elfinderInstance) {
            const instance = $(this.elfinderDiv.nativeElement).elfinder('instance');
            if (instance) {
                instance.destroy();
            }
            this.elfinderInstance = null;
        }
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
}
