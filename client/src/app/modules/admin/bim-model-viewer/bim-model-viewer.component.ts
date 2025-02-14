import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { TableModule } from 'primeng/table';
import { BimModelViewerService } from './bim-model-viewer.service';
import { DatePipe } from '@angular/common';
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
        DatePipe, FormsModule, TranslocoModule, TableModule,
        MatIconModule, MatButtonModule, MatInputModule, NgxSpinnerModule
    ]
})
export class BimModelViewerComponent implements OnInit, OnDestroy {

    selectedItems!: any;
    searchBinName: string;
    page: any = {};

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
    }

    onSearch(): void {
        this.search();
    }

    search(): void {
        let name = this.searchBinName || '';

        this._spinner.show();
        this._bimModelViewerService.getBmmsList({ 'name': name })
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (res) => {
                    if (res) {
                        this.page.data = res;
                        this._changeDetectorRef.markForCheck();
                        this._spinner.hide();
                    }
                },
                error: e => {
                    console.log(e)
                    // this._alert.open({ type: 'warn', message: JSON.stringify(e.message) });
                }
            });
    }

    onClickAggregated(): void {
        if (!this.selectedItems){
            this._toastService.open({ message: `${this._translocoService.translate('select-at-least-one-model')}.` });
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

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
