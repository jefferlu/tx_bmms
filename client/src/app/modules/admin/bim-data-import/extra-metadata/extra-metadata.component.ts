import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BimDataImportService } from '../bim-data-import.service';
import { TableModule } from 'primeng/table';

@Component({
    selector: 'extra-metadata',
    templateUrl: './extra-metadata.component.html',
    styleUrl: './extra-metadata.component.scss',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule, TableModule],
})
export class ExtraMetadataComponent implements OnInit, OnDestroy {

    objects = [];

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _cdr: ChangeDetectorRef,
        private _bimDataImportService: BimDataImportService
    ) { }

    ngOnInit(): void {
        this._bimDataImportService.getObjects()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((res) => {
                if (res) {
                    this.objects = res.filter(e => e.status === 'success');                    
                    this._cdr.markForCheck();
                }
            })
    }

    onExtraMetadata(object: any) {
        object.status = 'inprogress';
        object.progress = 'start extracting...';

        this._bimDataImportService.sse('extract-metadata', object.objectKey)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(res => {

                object.status = JSON.parse(res.data).status;
                object.progress = JSON.parse(res.data).message;
                this._cdr.markForCheck();
            });
    }

    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
