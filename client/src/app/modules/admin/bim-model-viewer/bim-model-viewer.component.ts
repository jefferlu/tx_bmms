import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { finalize, Subject, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { BimModelViewerService } from './bim-model-viewer.service';
import { MatDialog } from '@angular/material/dialog';
import { ApsViewerComponent } from 'app/layout/common/aps-viewer/aps-viewer.component';
import { ApsDiffComponent } from 'app/layout/common/aps-diff/aps-diff.component';

import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';
import { ToastService } from 'app/layout/common/toast/toast.service';


@Component({
    selector: 'app-bim-model-viewer',
    templateUrl: './bim-model-viewer.component.html',
    styleUrl: './bim-model-viewer.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe, FormsModule, TranslocoModule, TableModule, ButtonModule,
        MatIconModule, MatButtonModule, MatInputModule, NgxSpinnerModule
    ]
})
export class BimModelViewerComponent implements OnInit, OnDestroy {

    selectedItems!: any;
    searchBinName: string;

    data: any;

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _translocoService: TranslocoService,
        private _spinner: NgxSpinnerService,
        private _toastService: ToastService,
        private _bimModelViewerService: BimModelViewerService,
        private _matDialog: MatDialog
    ) { }

    ngOnInit(): void {
        this._spinner.hide();
        this.data=[];
    }

    onSearch(): void {
        this.search();
    }

    search(): void {
        let name = this.searchBinName || '';

        this._spinner.show();
        this._bimModelViewerService.getBmmsList({ 'name': name })
            .pipe(
                takeUntil(this._unsubscribeAll),
                finalize(() => {
                    this._spinner.hide();
                })
            )
            .subscribe({
                next: (res) => {
                    if (res) {
                        this.data = res;
                        console.log(res)
                        this._changeDetectorRef.markForCheck();
                    }
                },
                error: e => {
                    console.log(e)
                    // this._alert.open({ type: 'warn', message: JSON.stringify(e.message) });
                }
            });
    }

    onClickAggregated(): void {
        if (!this.selectedItems) {
            this._toastService.open({ message: `${this._translocoService.translate('select-at-least-one-model')}.` });
            return;
        }
        if (!this.checkTenderConsistency(this.selectedItems)) {
            this._toastService.open({ message: `${this._translocoService.translate('unsupported-aggregated-view')}.` });
            return;
        }

        this.showAggregatedDialog(this.selectedItems)
    }

    onClickCompare(): void {
        if (!this.selectedItems) {
            this._toastService.open({ message: `${this._translocoService.translate('select-at-least-one-model')}.` });
            return;
        }
        this.showCompareDialog(this.selectedItems)
    }


    showAggregatedDialog(items): void {
        this._matDialog.open(ApsViewerComponent, {
            width: '99vw',
            height: '95vh',
            data: items
        })
    }

    showCompareDialog(items): void {
        this._matDialog.open(ApsDiffComponent, {
            width: '99vw',
            height: '95vh',
            data: items
        })
    }

    onDownloadCsv(): void {

    }

    onDownloadBim(): void {

    }

    private checkTenderConsistency(data: any[]): boolean {
        const tenders = data.map(item => item.tender);
        return tenders.every(tender => tender === tenders[0]);
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
