import { CurrencyPipe, NgClass, NgSwitchCase, NgSwitch } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
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
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { GtsAlertComponent } from '@gts/components/alert';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { BackupRestoreService } from './backup-restore.service';
import { map, Subject, switchMap, takeUntil } from 'rxjs';
import { GtsConfirmationService } from '@gts/services/confirmation';
import { ToastService } from 'app/layout/common/toast/toast.service';

@Component({
    selector: 'backup-restore',
    templateUrl: './backup-restore.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        TranslocoModule, NgClass, FormsModule,
        MatButtonModule, MatIconModule, MatRadioModule,
        GtsAlertComponent
    ]
})
export class BackupRestoreComponent implements OnInit, OnDestroy {

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    data: any;
    plan: string = 'backup';

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _translocoService: TranslocoService,
        private _toastService: ToastService,
        private _gtsConfirmationService: GtsConfirmationService,
        private _backupRestoreService: BackupRestoreService
    ) { }

    ngOnInit(): void {
        // Get latest backup filename
        this._backupRestoreService.getData('core/latest-backup')
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((data: any) => {
                this.data = data;
                console.log(data)
                this._changeDetectorRef.markForCheck();
            });
    }

    onClick(): void {

        const title = this._translocoService.translate('confirm-action');
        const message = this._translocoService.translate('confirm-execution');
        const executeLabel = this._translocoService.translate('start-execution');
        const cancelLabel = this._translocoService.translate('cancel');

        let dialogRef = this._gtsConfirmationService.open({
            title: title,
            message: message,
            icon: { color: 'warn' },
            actions: { confirm: { label: executeLabel, color: 'warn' }, cancel: { label: cancelLabel } }

        });

        dialogRef.afterClosed().subscribe(result => {
            if (result === 'confirmed') {
                this.execute();
                this._changeDetectorRef.markForCheck();
            }
        });
    }

    execute(): void {
        if (this.plan === 'backup') {
            // execute backup
            this._backupRestoreService.getData('core/db-backup')
                .pipe(takeUntil(this._unsubscribeAll))
                .subscribe((data: any) => {
                    this._toastService.open({ message: this._translocoService.translate('run-in-task') });
                });
        }
        else {
            // execute restore
            this._backupRestoreService.getData('core/db-restore')
                .pipe(takeUntil(this._unsubscribeAll))
                .subscribe((data: any) => {
                    console.log(data)
                    this._toastService.open({ message: this._translocoService.translate('run-in-task') });
                });
        }


    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
