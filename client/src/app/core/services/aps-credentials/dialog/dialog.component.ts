import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule } from '@jsverse/transloco';
import { ApsCredentialsService } from '../aps-credentials.service';

@Component({
    selector: 'aps-credentials-dialog',
    templateUrl: './dialog.component.html',
    styleUrl: './dialog.component.scss',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [
        FormsModule, ReactiveFormsModule, TranslocoModule,
        MatButtonModule, MatIconModule, MatDialogModule, MatFormFieldModule, MatInputModule
    ],
})
export class ApsCredentialsDialogComponent implements OnInit {

    form: UntypedFormGroup;

    constructor(
        private _formBuilder: UntypedFormBuilder,
        private _apsCredentialsService: ApsCredentialsService,
        private _dialogRef: MatDialogRef<ApsCredentialsDialogComponent>
    ) { }

    ngOnInit(): void {
        // Create the form
        this.form = this._formBuilder.group({
            clientId: ['94MGPGEtqunCJS6XyZAAnztSSIrtfOLsVWQEkLNQ7uracrAC', Validators.required],
            clientSecret: ['G5tBYHoxe9xbpsisxGo5kBZOCPwEFCCuXIYr8kms28SSRuuVAHR0G766A3RKFQXy', Validators.required],
            bucketKey: ['bmms_oss', Validators.required]
        });
    }

    onSave(): void {

        if (this.form.invalid) {
            return;
        }

        this._apsCredentialsService.credientials = this.form.value;

        this._dialogRef.close('confirmed');
    }

}
