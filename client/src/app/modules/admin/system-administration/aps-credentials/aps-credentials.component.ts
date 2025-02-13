import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
    selector: 'aps-credentials',
    templateUrl: './aps-credentials.component.html',
    styleUrl: './aps-credentials.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule, ReactiveFormsModule, TranslocoModule,
        MatButtonModule, MatIconModule, MatDialogModule, MatFormFieldModule, MatInputModule
    ],
})
export class ApsCredentialsComponent implements OnInit {

    form: UntypedFormGroup;

    constructor(
        private _formBuilder: UntypedFormBuilder,
    ) { }

    ngOnInit(): void {
        this.form = this._formBuilder.group({
            clientId: ['94MGPGEtqunCJS6XyZAAnztSSIrtfOLsVWQEkLNQ7uracrAC', Validators.required],
            clientSecret: ['G5tBYHoxe9xbpsisxGo5kBZOCPwEFCCuXIYr8kms28SSRuuVAHR0G766A3RKFQXy', Validators.required],            
        });
    }

    onSave(): void {

        if (this.form.invalid) {
            return;
        }

        // this._apsCredentialsService.credientials = this.form.value;

    }
}
