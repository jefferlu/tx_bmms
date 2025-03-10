import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoModule } from '@jsverse/transloco';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { RadioButtonModule } from 'primeng/radiobutton';
import { Subject, takeUntil } from 'rxjs';
import { SystemActivityLogService } from './system-activity-log.service';

@Component({
    selector: 'app-system-activity-log',
    templateUrl: './system-activity-log.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule, TranslocoModule,
        ScrollPanelModule, RadioButtonModule,
        MatIconModule, MatButtonModule, MatInputModule,
    ],

})
export class SystemActivityLogComponent {

    private _unsubscribeAll: Subject<any> = new Subject<any>();
    data: any;
    container: string = 'client';

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _systemActivityLogService: SystemActivityLogService
    ) { }

    ngOnInit(): void {
        // Get groups data
        this._systemActivityLogService.getData('client', { lines: 200 })
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((data: any) => {
                this.data = data;                
                this._changeDetectorRef.markForCheck();
            });
    }

    onClick(container): void {
         // Get groups data
         this._systemActivityLogService.getData(container, { lines: 200 })
         .pipe(takeUntil(this._unsubscribeAll))
         .subscribe((data: any) => {
             this.data = data;                
             this._changeDetectorRef.markForCheck();
         });
    }    

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
