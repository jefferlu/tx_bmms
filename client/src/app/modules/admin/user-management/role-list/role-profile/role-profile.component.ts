import { NgFor, NgIf, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { TableModule } from 'primeng/table';
import { CheckboxModule } from 'primeng/checkbox';

import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
    selector: 'role-profile',
    templateUrl: './role-profile.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [FormsModule, ReactiveFormsModule, MatSlideToggleModule, MatButtonModule, TranslocoModule],
})
export class RoleProfileComponent implements OnInit {
    roleprofileForm: UntypedFormGroup;

    /**
     * Constructor
     */
    constructor(
        private _formBuilder: UntypedFormBuilder,
    ) {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Create the form
        this.roleprofileForm = this._formBuilder.group({
            apsconvert: [true],
            bimfile: [true],
            digitalfile: [false],
            comments: [false],
            listing: [true],
            exportlisting: [true],
            viewer: [false],
            usermanagement: [true],
            profilemanagement: [false],
            history: [true],
            credential: [true],
            dbmanagement: [true],
            syslog: [true]
        });
    }
}
