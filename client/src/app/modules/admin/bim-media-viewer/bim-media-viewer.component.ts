import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
    selector: 'bim-media-viewer',
    template: '<router-outlet></router-outlet>',
    standalone: true,
    imports: [RouterOutlet]
})
export class BimMediaViewerComponent {
    constructor() {}
}
