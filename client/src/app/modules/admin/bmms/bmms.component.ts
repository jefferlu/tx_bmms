import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';

declare const Autodesk: any;

@Component({
    selector: 'app-bmms',
    templateUrl: './bmms.component.html',
    styleUrl: './bmms.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [RouterOutlet]
})
export class BmmsComponent {

    constructor() { }

}
