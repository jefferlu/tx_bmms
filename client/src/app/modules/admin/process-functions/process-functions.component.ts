import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
    selector: 'app-process-functions',
    templateUrl: './process-functions.component.html',
    styleUrl: './process-functions.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [RouterOutlet],

})
export class ProcessFunctionsComponent {

    constructor() { }

}
