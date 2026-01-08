import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
    selector: 'file-manager',
    template: '<router-outlet></router-outlet>',
    standalone: true,
    imports: [RouterOutlet]
})
export class FileManagerComponent {
    constructor() {}
}
