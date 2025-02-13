import { CurrencyPipe, NgClass, NgSwitchCase, NgSwitch } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import {
    FormsModule,
    ReactiveFormsModule,
    UntypedFormBuilder,
    UntypedFormGroup,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { GtsAlertComponent } from '@gts/components/alert';

@Component({
    selector: 'backup-restore',
    templateUrl: './backup-restore.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        ReactiveFormsModule,
        GtsAlertComponent,
        MatRadioModule,
        NgClass,
        NgSwitch,
        NgSwitchCase,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatOptionModule,
        MatButtonModule,
    ]
})
export class BackupRestoreComponent implements OnInit {
    backupRestoreForm: UntypedFormGroup;
    plans: any[];

    /**
     * Constructor
     */
    constructor(private _formBuilder: UntypedFormBuilder) {}

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Create the form
        this.backupRestoreForm = this._formBuilder.group({
            plan: ['team'],
            cardHolder: ['Brian Hughes'],
            cardNumber: [''],
            cardExpiration: [''],
            cardCVC: [''],
            country: ['usa'],
            zip: [''],
        });

        // Setup the plans
        this.plans = [
            {
                value: 'backup',
                label: '立即備份資料庫',
                details: '產生資料庫備份檔',
                price: '',
            },
            {
                value: 'restore',
                label: '還原資料庫',
                details: '還原前次資料庫備份',
                price: '2024-08-15-00-12-01.bak',
            },
        ];
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Track by function for ngFor loops
     *
     * @param index
     * @param item
     */
    trackByFn(index: number, item: any): any {
        return item.id || index;
    }
}
