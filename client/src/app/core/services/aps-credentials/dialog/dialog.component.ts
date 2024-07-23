import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule } from '@jsverse/transloco';

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

    constructor(private _formBuilder: UntypedFormBuilder,) { }

    ngOnInit(): void {
        // Create the form
        this.form = this._formBuilder.group({
            clientId: ['47aKP8JTOibKQTvtpdugm8r05baqLxtF'],
            clientSecret: ['UOnLHJkAYTAQAAAP'],
            bucketName: ['bmms_oss']
        });
    }

}
