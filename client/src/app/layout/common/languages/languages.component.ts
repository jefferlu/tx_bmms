import { NgFor, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { FuseNavigationService, FuseVerticalNavigationComponent } from '@fuse/components/navigation';
import { AvailableLangs, TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';

@Component({
    selector: 'languages',
    templateUrl: './languages.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    exportAs: 'languages',
    standalone: true,
    imports: [MatButtonModule, MatMenuModule, NgTemplateOutlet, NgFor],
})
export class LanguagesComponent implements OnInit, OnDestroy {
    availableLangs: AvailableLangs;
    activeLang: string;
    flagCodes: any;

    /**
     * Constructor
     */
    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _fuseNavigationService: FuseNavigationService,
        private _translocoService: TranslocoService,
    ) {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Get the available languages from transloco
        this.availableLangs = this._translocoService.getAvailableLangs();

        // Subscribe to language changes
        this._translocoService.langChanges$.subscribe((activeLang) => {
            // Get the active lang
            this.activeLang = activeLang;

            // Update the navigation
            this._updateNavigation(activeLang);
        });

        // Set the country iso codes for languages for flags
        this.flagCodes = {
            'en': 'us',
            'zh': 'tw'
        };
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Set the active lang
     *
     * @param lang
     */
    setActiveLang(lang: string): void {
        // Set the active lang
        this._translocoService.setActiveLang(lang);
    }

    /**
     * Track by function for ngFor loops
     *
     * @param index
     * @param item
     */
    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Update the navigation
     *
     * @param lang
     * @private
     */
    private _updateNavigation(lang: string): void {
        // For the demonstration purposes, we will only update the Dashboard names
        // from the navigation but you can do a full swap and change the entire
        // navigation data.
        //
        // You can import the data from a file or request it from your backend,
        // it's up to you.

        // Get the component -> navigation data -> item
        const navComponent = this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>('mainNavigation');

        // Return if the navigation component does not exist
        if (!navComponent) {
            return null;
        }

        // Get the flat navigation data
        const navigation = navComponent.navigation;

        /* Get the menu item and update its title */
        const processFunctionsItem = this._fuseNavigationService.getItem('process_functions', navigation);
        if (processFunctionsItem) {
            this._translocoService.selectTranslate('bim-information-listing').pipe(take(1))
                .subscribe((translation) => {
                    // Set the title
                    processFunctionsItem.title = translation;

                    // Refresh the navigation component
                    navComponent.refresh();
                });
        }

        const bimModelViewerItem = this._fuseNavigationService.getItem('bim-model-viewer', navigation);
        if (bimModelViewerItem) {
            this._translocoService.selectTranslate('bim-model-viewer').pipe(take(1))
                .subscribe((translation) => {
                    // Set the title
                    bimModelViewerItem.title = translation;

                    // Refresh the navigation component
                    navComponent.refresh();
                });
        }

        const bimDataImportItem = this._fuseNavigationService.getItem('bim_data_import', navigation);
        if (bimDataImportItem) {
            this._translocoService.selectTranslate('Analytics').pipe(take(1))
                .subscribe((translation) => {
                    // Set the title
                    bimDataImportItem.title = translation;

                    // Refresh the navigation component
                    navComponent.refresh();
                });
        }

        const userManagementItem = this._fuseNavigationService.getItem('user_management', navigation);
        if (userManagementItem) {
            this._translocoService.selectTranslate('user-management').pipe(take(1))
                .subscribe((translation) => {
                    // Set the title
                    userManagementItem.title = translation;

                    // Refresh the navigation component
                    navComponent.refresh();
                });
        }

        const systemAdministrationItem = this._fuseNavigationService.getItem('system_administration', navigation);
        if (systemAdministrationItem) {
            this._translocoService.selectTranslate('system-administration').pipe(take(1))
                .subscribe((translation) => {
                    // Set the title
                    systemAdministrationItem.title = translation;

                    // Refresh the navigation component
                    navComponent.refresh();
                });
        }
    }
}
