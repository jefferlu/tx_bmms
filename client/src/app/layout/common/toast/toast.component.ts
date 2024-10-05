import { Component, Inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA } from '@angular/material/snack-bar';
import { FuseAlertComponent } from '@fuse/components/alert/alert.component';
import { FuseAlertType } from '@fuse/components/alert/alert.types';

@Component({
    selector: 'app-toast',
    templateUrl: './toast.component.html',
    styleUrls: ['./toast.component.scss'],
    standalone: true,
    imports: [FuseAlertComponent]
})
export class ToastComponent {

    type: FuseAlertType = 'primary';
    constructor(@Inject(MAT_SNACK_BAR_DATA) public data: any) {

    }

    ngOnInit(): void {
        if (this.data.type) {
            this.type = this.data.type;
        }
    }
}
