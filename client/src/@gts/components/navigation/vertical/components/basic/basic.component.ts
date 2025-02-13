import { NgClass, NgIf, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IsActiveMatchOptions, RouterLink, RouterLinkActive } from '@angular/router';
import { GtsNavigationService } from '@gts/components/navigation/navigation.service';
import { GtsNavigationItem } from '@gts/components/navigation/navigation.types';
import { GtsVerticalNavigationComponent } from '@gts/components/navigation/vertical/vertical.component';
import { GtsUtilsService } from '@gts/services/utils/utils.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'gts-vertical-navigation-basic-item',
    templateUrl: './basic.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgClass, NgIf, RouterLink, RouterLinkActive, MatTooltipModule, NgTemplateOutlet, MatIconModule]
})
export class GtsVerticalNavigationBasicItemComponent implements OnInit, OnDestroy
{
    @Input() item: GtsNavigationItem;
    @Input() name: string;

    isActiveMatchOptions: IsActiveMatchOptions;
    private _gtsVerticalNavigationComponent: GtsVerticalNavigationComponent;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _gtsNavigationService: GtsNavigationService,
        private _gtsUtilsService: GtsUtilsService,
    )
    {
        // Set the equivalent of {exact: false} as default for active match options.
        // We are not assigning the item.isActiveMatchOptions directly to the
        // [routerLinkActiveOptions] because if it's "undefined" initially, the router
        // will throw an error and stop working.
        this.isActiveMatchOptions = this._gtsUtilsService.subsetMatchOptions;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void
    {
        // Set the "isActiveMatchOptions" either from item's
        // "isActiveMatchOptions" or the equivalent form of
        // item's "exactMatch" option
        this.isActiveMatchOptions =
            this.item.isActiveMatchOptions ?? this.item.exactMatch
                ? this._gtsUtilsService.exactMatchOptions
                : this._gtsUtilsService.subsetMatchOptions;

        // Get the parent navigation component
        this._gtsVerticalNavigationComponent = this._gtsNavigationService.getComponent(this.name);

        // Mark for check
        this._changeDetectorRef.markForCheck();

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
