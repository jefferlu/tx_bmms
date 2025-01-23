import { NgFor, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { GtsNavigationItem, GtsNavigationService, GtsVerticalNavigationComponent } from '@gts/components/navigation';
import { AvailableLangs, Translation, TranslocoService } from '@jsverse/transloco';
import { LocalStorageService } from 'app/core/services/local-storage/local-storage.service';
import { firstValueFrom, take } from 'rxjs';

@Component({
    selector: 'languages',
    templateUrl: './languages.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    exportAs: 'languages',
    standalone: true,
    imports: [MatButtonModule, MatMenuModule, NgTemplateOutlet, NgFor, MatIconModule,],
})
export class LanguagesComponent implements OnInit, OnDestroy {
    availableLangs: AvailableLangs;
    activeLang: string;

    /**
     * Constructor
     */
    constructor(
        private _gtsNavigationService: GtsNavigationService,
        private _translocoService: TranslocoService,
        private _localStorageService: LocalStorageService
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
        this._localStorageService.language = lang;
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
    private async _updateNavigation(lang: string) {
        // For the demonstration purposes, we will only update the Dashboard names
        // from the navigation but you can do a full swap and change the entire
        // navigation data.
        //
        // You can import the data from a file or request it from your backend,
        // it's up to you.

        // Get the component -> navigation data -> item
        const navComponent = this._gtsNavigationService.getComponent<GtsVerticalNavigationComponent>('mainNavigation');

        // Return if the navigation component does not exist
        if (!navComponent) {
            return null;
        }

        // Get the flat navigation data
        const navigation = navComponent.navigation;

        // Get all i18n translation dictionary
        const translations = await firstValueFrom(this._translocoService.selectTranslation());

        // Recursive get the item and update its title
        this._translateNavigation(navigation, translations);
        
        navComponent.refresh();
        
    }

    private _translateNavigation(navigation: GtsNavigationItem[], translations: Translation) {
        navigation.forEach(nav => {            
            nav.title = translations[nav.title_locale] || nav.title_locale;
            nav.subtitle = translations[nav.subtitle_locale] || nav.subtitle_locale;
            if (nav.children) this._translateNavigation(nav.children, translations);
        })
    }
}
