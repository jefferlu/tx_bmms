import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ApsCredentialsDialogComponent } from './dialog/dialog.component';

@Injectable({
    providedIn: 'root'
})
export class ApsCredentialsService {

    constructor(private _matDialog: MatDialog) { }

    open(): MatDialogRef<ApsCredentialsDialogComponent> {

        return this._matDialog.open(ApsCredentialsDialogComponent,{
            width: '30vw',
            height: '60vh',
            disableClose: true
        })
    }
}
