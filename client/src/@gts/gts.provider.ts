import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { EnvironmentProviders, importProvidersFrom, inject, Provider, provideEnvironmentInitializer, provideAppInitializer } from '@angular/core';
import { MATERIAL_SANITY_CHECKS } from '@angular/material/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { GTS_MOCK_API_DEFAULT_DELAY, mockApiInterceptor } from '@gts/lib/mock-api';
import { GtsConfig } from '@gts/services/config';
import { GTS_CONFIG } from '@gts/services/config/config.constants';
import { GtsConfirmationService } from '@gts/services/confirmation';
import { gtsLoadingInterceptor, GtsLoadingService } from '@gts/services/loading';
import { GtsMediaWatcherService } from '@gts/services/media-watcher';
import { GtsPlatformService } from '@gts/services/platform';
import { GtsSplashScreenService } from '@gts/services/splash-screen';
import { GtsUtilsService } from '@gts/services/utils';

export type GtsProviderConfig = {
    mockApi?: {
        delay?: number;
        service?: any;
    },
    gts?: GtsConfig
}

/**
 * Gts provider
 */
export const provideGts = (config: GtsProviderConfig): Array<Provider | EnvironmentProviders> => {
    // Base providers
    const providers: Array<Provider | EnvironmentProviders> = [
        // {
        //     // Disable 'theme' sanity check
        //     provide : MATERIAL_SANITY_CHECKS,
        //     useValue: {
        //         doctype: true,
        //         theme  : false,
        //         version: true,
        //     },
        // },
        {
            // Use the 'fill' appearance on Angular Material form fields by default
            provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
            useValue: {
                appearance: 'fill',
            },
        },
        {
            provide: GTS_MOCK_API_DEFAULT_DELAY,
            useValue: config?.mockApi?.delay ?? 0,
        },
        {
            provide: GTS_CONFIG,
            useValue: config?.gts ?? {},
        },

        importProvidersFrom(MatDialogModule),
        provideEnvironmentInitializer(() => inject(GtsConfirmationService)),

        provideHttpClient(withInterceptors([gtsLoadingInterceptor])),
        provideEnvironmentInitializer(() => inject(GtsLoadingService)),

        provideEnvironmentInitializer(() => inject(GtsMediaWatcherService)),
        provideEnvironmentInitializer(() => inject(GtsPlatformService)),
        provideEnvironmentInitializer(() => inject(GtsSplashScreenService)),
        provideEnvironmentInitializer(() => inject(GtsUtilsService)),
    ];

    // Mock Api services
    if (config?.mockApi?.service) {
        providers.push(
            provideHttpClient(withInterceptors([mockApiInterceptor])),
            provideAppInitializer(() => {
                const mockApiService = inject(config.mockApi.service);
            }),
        );
    }

    // Return the providers
    return providers;
};
