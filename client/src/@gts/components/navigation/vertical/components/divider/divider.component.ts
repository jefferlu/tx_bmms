import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { GtsNavigationService } from '@gts/components/navigation/navigation.service';
import { GtsNavigationItem } from '@gts/components/navigation/navigation.types';
import { GtsVerticalNavigationComponent } from '@gts/components/navigation/vertical/vertical.component';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector       : 'gts-vertical-navigation-divider-item',
    templateUrl    : './divider.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone     : true,
    imports        : [NgClass],
})
export class GtsVerticalNavigationDividerItemComponent implements OnInit, OnDestroy
{
    @Input() item: GtsNavigationItem;
    @Input() name: string;

    private _gtsVerticalNavigationComponent: GtsVerticalNavigationComponent;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _gtsNavigationService: GtsNavigationService,
    )
    {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void
    {
        // Get the parent navigation component
        this._gtsVerticalNavigationComponent = this._gtsNavigationService.getComponent(this.name);

        // Subscribe to onRefreshed on the navigation component
        this._gtsVerticalNavigationComponent.onRefreshed.pipe(
            takeUntil(this._unsubscribeAll),
        ).subscribe(() =>
        {
            // Mark for check
            this._changeDetectorRef.markForCheck();
        });
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void
    {
        // Unsubscribe from all subscriptions
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }
}
