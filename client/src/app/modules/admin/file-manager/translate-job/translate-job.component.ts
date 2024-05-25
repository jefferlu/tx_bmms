import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { FileManagerService } from '../file-manager.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'translate-job',
    templateUrl: './translate-job.component.html',
    styleUrl: './translate-job.component.scss',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule],
})
export class TranslateJobComponent implements OnInit, OnDestroy {

    objects = [];

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _cdr: ChangeDetectorRef,
        private _fileManagerService: FileManagerService,
    ) { }

    ngOnInit(): void {
        this._fileManagerService.getObjects()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((res) => {
                console.log(res)
                this.objects = res;
                this._cdr.markForCheck();
            })
    }

    onTranslateJob(object: any) {
        object.status = 'inprogress';
        object.progress = 'start translating...';
        this._fileManagerService.sse('translate-job', object.objectKey)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(res => {
                object.status = JSON.parse(res.data).status;
                object.progress = JSON.parse(res.data).progress;
                this._cdr.markForCheck();
            });
    }

    onRefreshObject(object: any) {
        this._fileManagerService.getObject(object.objectKey)
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
