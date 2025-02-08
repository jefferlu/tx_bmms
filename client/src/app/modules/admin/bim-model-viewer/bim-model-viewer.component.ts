import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterOutlet } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { TableModule } from 'primeng/table';
import { BimModelViewerService } from './bim-model-viewer.service';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { ApsViewerComponent } from 'app/layout/common/aps-viewer/aps-viewer.component';
import { Subject, takeUntil } from 'rxjs';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
    selector: 'app-bim-model-viewer',
    templateUrl: './bim-model-viewer.component.html',
    styleUrl: './bim-model-viewer.component.scss',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        DatePipe, FormsModule, TranslocoModule, TableModule,
        MatIconModule, MatButtonModule, MatInputModule
    ],
})
export class BimModelViewerComponent implements OnInit, OnDestroy {

    searchBinName: string;
    page: any = {};

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _spinnser: NgxSpinnerService,
        private _bimModelViewerService: BimModelViewerService,
        private _matDialog: MatDialog
    ) { }

    ngOnInit(): void { }

    onSearch(): void {
        this.search();
    }

    search(): void {
        let name = this.searchBinName || '';

        this._spinnser.show();
        this._bimModelViewerService.getBmmsList({ 'name': name })
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (res) => {
                    if (res) {
                        this.page.data = res;
                        this._changeDetectorRef.markForCheck();
                        this._spinnser.hide();
                    }
                },
                error: e => {
                    console.log(e)
                    // this._alert.open({ type: 'warn', message: JSON.stringify(e.message) });
                }
            });
    }

    onModelDialog(item): void {

        this._matDialog.open(ApsViewerComponent, {
            width: '70vw',
            height: '90vh',
            data: item
        })
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
