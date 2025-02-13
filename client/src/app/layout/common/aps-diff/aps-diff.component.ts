import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { SideBySideDiffComponent } from 'ngx-diff';

@Component({
    selector: 'aps-diff',
    templateUrl: './aps-diff.component.html',
    styleUrl: './aps-diff.component.scss',
    encapsulation: ViewEncapsulation.None,
    imports: [SideBySideDiffComponent]
})
export class ApsDiffComponent implements OnInit {

    before: string = ''
    after: string = ''

    ngOnInit(): void {

        this.before = `
            apples
            oranges
            kiwis
            strawberries`;
        
        this.after=`
            apples
            pears
            kiwis
            grapefruit
            strawberries
        `
    }

}
