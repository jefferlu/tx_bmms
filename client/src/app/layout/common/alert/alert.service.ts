import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition } from '@angular/material/snack-bar';
import { AlertComponent } from './alert.component';

@Injectable({
    providedIn: 'root'
})
export class AlertService {

    horizontalPosition: MatSnackBarHorizontalPosition = 'end';
    verticalPosition: MatSnackBarVerticalPosition = 'bottom';

    constructor(private _snackBar: MatSnackBar) { }

    open(data: any): void {
        this._snackBar.openFromComponent(AlertComponent, {
            horizontalPosition: this.horizontalPosition,
            verticalPosition: this.verticalPosition,
            panelClass: [`snackbar-customer`], // overwrite default style
            duration: (data.duration ?? 3) * 1000,
            data: data
        });
    }
}
