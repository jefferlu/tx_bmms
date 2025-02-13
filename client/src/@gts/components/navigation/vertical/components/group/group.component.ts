import { BooleanInput } from '@angular/cdk/coercion';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, forwardRef, Input, OnDestroy, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { GtsNavigationService } from '@gts/components/navigation/navigation.service';
import { GtsNavigationItem } from '@gts/components/navigation/navigation.types';
import { GtsVerticalNavigationBasicItemComponent } from '@gts/components/navigation/vertical/components/basic/basic.component';
import { GtsVerticalNavigationCollapsableItemComponent } from '@gts/components/navigation/vertical/components/collapsable/collapsable.component';
import { GtsVerticalNavigationDividerItemComponent } from '@gts/components/navigation/vertical/components/divider/divider.component';
import { GtsVerticalNavigationSpacerItemComponent } from '@gts/components/navigation/vertical/components/spacer/spacer.component';
import { GtsVerticalNavigationComponent } from '@gts/components/navigation/vertical/vertical.component';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'gts-vertical-navigation-group-item',
    templateUrl: './group.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgClass, NgIf, MatIconModule, NgFor, GtsVerticalNavigationBasicItemComponent, GtsVerticalNavigationCollapsableItemComponent, GtsVerticalNavigationDividerItemComponent, forwardRef(() => GtsVerticalNavigationGroupItemComponent), GtsVerticalNavigationSpacerItemComponent]
})
export class GtsVerticalNavigationGroupItemComponent implements OnInit, OnDestroy
{
    /* eslint-disable @typescript-eslint/naming-convention */
    static ngAcceptInputType_autoCollapse: BooleanInput;
    /* eslint-enable @typescript-eslint/naming-convention */

    @Input() autoCollapse: boolean;
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

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Track by function for ngFor loops
     *
     * @param index
     * @param item
     */
    trackByFn(index: number, item: any): any
    {
        return item.id || index;
    }
}
