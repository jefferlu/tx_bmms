import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { WebsocketService } from 'app/core/services/websocket/websocket.service';
import { TableModule } from 'primeng/table';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { BimManagementService } from './bim-management.service';

@Component({
    selector: 'app-bim-management',
    templateUrl: './bim-management.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatButtonModule, MatIconModule, MatProgressSpinnerModule,
        TranslocoModule, TableModule, NgClass
    ],
})

export class BimManagementComponent implements OnInit, OnDestroy {

    data: any;
    private _subscription: Subscription = new Subscription();
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _route: ActivatedRoute,
        private _changeDetectorRef: ChangeDetectorRef,
        private _websocketService: WebsocketService,
        private _bimManagementService: BimManagementService
    ) { }

    ngOnInit(): void {

        // Subscribe webSocket message
        this._websocketService.connect('update-category');
        this._subscription.add(
            this._websocketService.onMessage('update-category').subscribe({
                next: (res) => {

                    res.name = decodeURIComponent(res.name);

                    // 根據 WebSocket 訊息更新檔案列表中的檔案
                    this.data = this.data.map(d => {
                        if (d.name === res.name) {
                            return {
                                ...d,
                                status: res.status,
                                message: res.message
                            };
                        }
                        return d;
                    });

                    this._changeDetectorRef.markForCheck();
                },
                error: (err) => console.error('WebSocket error:', err),
                complete: () => console.log('WebSocket connection closed.'),
            })
        );

        // Get data
        this._route.data.subscribe({
            next: (res) => {
                res.data = res.data.map(r => { return { ...r, status: 'complete' }; });
                this.data = res.data;
                console.log(this.data)
                this._changeDetectorRef.markForCheck();
                console.log('Data loaded:', this.data);
            },
            error: (e) => {
                console.error('Error loading data:', e);
            }
        });
    }

    onReprocessData(filename: string = null): void {
        const request: any = { ...(filename && { filenames: [filename] }) }
        console.log(request)
        
        this._bimManagementService.bimReprocessData(request)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (res) => { },
                error: (err) => {
                    console.log(err)
                }
            });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
        this._subscription.unsubscribe();
        this._websocketService.close('update-category');
    }
}
