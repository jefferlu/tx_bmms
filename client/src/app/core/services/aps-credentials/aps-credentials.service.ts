import { inject, Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ApsCredentialsDialogComponent } from './dialog/dialog.component';
import { environment } from 'environments/environment';

const APS_CREDENTIALS_KEY: string = environment.local_storage.aps;

@Injectable({
    providedIn: 'root'
})
export class ApsCredentialsService {

    private _matDialog = inject(MatDialog)

    set credientials(credentials) {
        localStorage.setItem(APS_CREDENTIALS_KEY, JSON.stringify(credentials));
    }

    get credientials(): any {
        return JSON.parse(localStorage.getItem(APS_CREDENTIALS_KEY)) ?? undefined;
    }

    check(): boolean {
        console.log(this.credientials)
        return this.credientials ? true : false;
    }

    open(): MatDialogRef<ApsCredentialsDialogComponent> {

        return this._matDialog.open(ApsCredentialsDialogComponent, {
            width: '35vw',
            height: '60vh',
            disableClose: true
        })
    }

    remove(): void {
        localStorage.removeItem(APS_CREDENTIALS_KEY);
    }

}
