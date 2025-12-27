import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, ViewEncapsulation, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
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
    imports: []
})
export class BimMediaViewerComponent {

    @ViewChild('elfinder') elfinderDiv!: ElementRef;

    lang: any;

    private _authService = inject(AuthService);

    constructor(
        private _translocoService: TranslocoService,
    ) { }
    ngAfterViewInit(): void {

        this.lang = this.getViewerLanguage(this._translocoService.getActiveLang());

        // 獲取 JWT access token
        const token = this._authService.accessToken;

        $(this.elfinderDiv.nativeElement).elfinder({
            cssAutoLoad: false,               // Disable CSS auto loading
            langAutoLoad: false,              // 禁用語言文件自動載入（避免 404 錯誤）
            baseUrl: `${endpoint}/elfinder/`, // 使用 elfinder 服務器的完整 URL
            url: `${endpoint}/elfinder/php/connector.minimal.php`,  // connector URL (REQUIRED)
            lang: this.lang,                  // language (OPTIONAL)
            height: 'auto',
            width: '100%',
            // 添加 JWT token 到請求 header
            customHeaders: {
                'Authorization': `Bearer ${token}`
            },
            // 處理認證錯誤
            handlers: {
                error: (event: any, elFinder: any) => {
                    const error = event.data.error;
                    if (error && error.toLowerCase().includes('unauthorized')) {
                        console.error('elFinder 認證失敗，請重新登入');
                        // 可選：導航到登入頁面
                        // this._router.navigate(['/sign-in']);
                    }
                }
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

    private getViewerLanguage(lang: string): string {
        switch (lang) {
            case 'zh':
                return 'zh-TW';
            case 'en':
            default:  // 默認為英文
                return 'en';
        }
    }
}
