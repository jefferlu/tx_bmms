import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
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
import { ToastService } from 'app/layout/common/toast/toast.service';


@Component({
    selector: 'app-bim-model-viewer',
    templateUrl: './bim-model-viewer.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe, FormsModule, TranslocoModule, TableModule, ButtonModule,
        MatIconModule, MatButtonModule, MatInputModule
    ]
})
export class BimModelViewerComponent implements OnInit, OnDestroy {

    data: any;
    selectedItems!: any;

    constructor(
        private _route: ActivatedRoute,
        private _changeDetectorRef: ChangeDetectorRef,
        private _translocoService: TranslocoService,
        private _toastService: ToastService,
        private _matDialog: MatDialog
    ) { }

    ngOnInit(): void {
        this._route.data.subscribe({
            next: (res) => {
                this.data = res.data;
                this._changeDetectorRef.markForCheck();
                console.log('Data loaded:', this.data);
            },
            error: (e) => {
                console.error('Error loading data:', e);
            }
        });
    }

    onClickAggregated(): void {
        if (!this.selectedItems) {
            this._toastService.open({ message: `${this._translocoService.translate('select-at-least-one-model')}.` });
            return;
        }
        // if (!this.checkTenderConsistency(this.selectedItems)) {
        //     this._toastService.open({ message: `${this._translocoService.translate('unsupported-aggregated-view')}.` });
        //     return;
        // }
        console.log(this.selectedItems);
        this._matDialog.open(ApsViewerComponent, {
            width: '99vw',
            height: '95vh',
            data: this.selectedItems
        })
    }

    onClickCompare(): void {
        if (!this.selectedItems) {
            this._toastService.open({ message: `${this._translocoService.translate('select-at-least-one-model')}.` });
            return;
        }
        this.showCompareDialog(this.selectedItems)
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

    ngOnDestroy(): void { }
}
