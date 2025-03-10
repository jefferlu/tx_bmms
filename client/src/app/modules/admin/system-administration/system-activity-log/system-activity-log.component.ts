import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule } from '@jsverse/transloco';
import { TableModule } from 'primeng/table';
import { Subject, takeUntil } from 'rxjs';
import { SystemActivityLogService } from './system-activity-log.service';

@Component({
    selector: 'app-system-activity-log',
    templateUrl: './system-activity-log.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule, TranslocoModule, TableModule, DatePipe,
        MatIconModule, MatButtonModule, MatInputModule,
    ],

})
export class SystemActivityLogComponent {

    private _unsubscribeAll: Subject<any> = new Subject<any>();
    data: any;

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _systemActivityLogService: SystemActivityLogService
    ) { }

    ngOnInit(): void {
        // Get groups data
        this._systemActivityLogService.data$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((data: any) => {
                this.data = data;
            });
    }

    onSearch(): void {
        this.search();
    }

    search(): void {

    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
