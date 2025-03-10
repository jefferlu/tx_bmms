import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, ViewEncapsulation } from '@angular/core';
import { environment } from 'environments/environment';

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

    ngAfterViewInit(): void {

        $(this.elfinderDiv.nativeElement).elfinder({
            cssAutoLoad: false,               // Disable CSS auto loading
            baseUrl: './elfinder/',
            url: `${endpoint}/elfinder/php/connector.minimal.php`,  // connector URL (REQUIRED)
            lang: 'zh_TW',                // language (OPTIONAL)
            height: 'auto',
            width:'100%',         
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
}
