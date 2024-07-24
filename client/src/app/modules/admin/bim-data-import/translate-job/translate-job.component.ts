import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BimDataImportService } from '../bim-data-import.service';
import { TableModule } from 'primeng/table';
import { ApsCredentialsService } from 'app/core/services/aps-credentials/aps-credentials.service';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
    selector: 'translate-job',
    templateUrl: './translate-job.component.html',
    styleUrl: './translate-job.component.scss',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule, TableModule],
})
export class TranslateJobComponent implements OnInit, OnDestroy {

    objects = [];

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _cdr: ChangeDetectorRef,
        private _spinner: NgxSpinnerService,
        private _bimDataImportService: BimDataImportService,
        private _apsCredentials: ApsCredentialsService        
    ) { }

    ngOnInit(): void {
        if (!this._apsCredentials.check()) {
            this._apsCredentials.open().afterClosed().subscribe(res => {
                if (res != 'confirmed') return;
                this._getObjects();
            });
        }
        else { this._getObjects(); }
    }

    private _getObjects() {
        this._spinner.show();
        this._bimDataImportService.getObjects()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((res) => {                
                this.objects = res;
                this._cdr.markForCheck();
                this._spinner.hide();
            })
    }

    onTranslateJob(object: any) {
        object.status = 'inprogress';
        object.progress = 'start translating...';
        this._bimDataImportService.sse('translate-job', object.objectKey)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(res => {
                object.status = JSON.parse(res.data).status;
                object.progress = JSON.parse(res.data).progress;
                this._cdr.markForCheck();
            });
    }

    onRefreshObject(object: any) {
        this._bimDataImportService.getObject(object.objectKey)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(res => {
                // object = res; //loose variable connection

                object.status = res.status;
                object.progress = res.progress;
                object.refresh = res.refresh;
                this._cdr.markForCheck();
            })
    }

    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    ngOnDestroy(): void {
        // Unsubscribe from all subscriptions
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
