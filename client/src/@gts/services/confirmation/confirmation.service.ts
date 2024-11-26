import { inject, Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { GtsConfirmationConfig } from '@gts/services/confirmation/confirmation.types';
import { GtsConfirmationDialogComponent } from '@gts/services/confirmation/dialog/dialog.component';
import { merge } from 'lodash-es';

@Injectable({providedIn: 'root'})
export class GtsConfirmationService
{
    private _matDialog: MatDialog = inject(MatDialog);
    private _defaultConfig: GtsConfirmationConfig = {
        title      : 'Confirm action',
        message    : 'Are you sure you want to confirm this action?',
        icon       : {
            show : true,
            name : 'heroicons_outline:exclamation-triangle',
            color: 'warn',
        },
        actions    : {
            confirm: {
                show : true,
                label: 'Confirm',
                color: 'warn',
            },
            cancel : {
                show : true,
                label: 'Cancel',
            },
        },
        dismissible: false,
    };

    /**
     * Constructor
     */
    constructor()
    {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    open(config: GtsConfirmationConfig = {}): MatDialogRef<GtsConfirmationDialogComponent>
    {
        // Merge the user config with the default config
        const userConfig = merge({}, this._defaultConfig, config);

        // Open the dialog
        return this._matDialog.open(GtsConfirmationDialogComponent, {
            autoFocus   : false,
            disableClose: !userConfig.dismissible,
            data        : userConfig,
            panelClass  : 'gts-confirmation-dialog-panel',
        });
    }
}
