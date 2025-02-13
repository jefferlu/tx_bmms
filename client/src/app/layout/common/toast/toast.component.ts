import { Component, Inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA } from '@angular/material/snack-bar';
import { GtsAlertComponent } from '@gts/components/alert/alert.component';
import { GtsAlertType } from '@gts/components/alert/alert.types';

@Component({
    selector: 'app-toast',
    templateUrl: './toast.component.html',
    styleUrls: ['./toast.component.scss'],
    imports: [GtsAlertComponent]
})
export class ToastComponent {

    type: GtsAlertType = 'primary';
    constructor(@Inject(MAT_SNACK_BAR_DATA) public data: any) {

    }

    ngOnInit(): void {
        if (this.data.type) {
            this.type = this.data.type;
        }
    }
}
