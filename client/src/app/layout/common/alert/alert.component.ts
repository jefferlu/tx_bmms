import { Component, Inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA } from '@angular/material/snack-bar';
import { FuseAlertComponent, FuseAlertType } from '@fuse/components/alert';

@Component({
    selector: 'app-alert',
    templateUrl: './alert.component.html',
    styleUrls: ['./alert.component.scss'],
    standalone: true,
    imports: [FuseAlertComponent]
})
export class AlertComponent {

    type: FuseAlertType = 'primary';

    constructor(@Inject(MAT_SNACK_BAR_DATA) public data: any) {

    }

    ngOnInit(): void {
        if (this.data.type) {
            this.type = this.data.type;
        }
    }
}
