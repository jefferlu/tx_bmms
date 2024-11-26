import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { APP_INITIALIZER, ENVIRONMENT_INITIALIZER, EnvironmentProviders, importProvidersFrom, inject, Provider } from '@angular/core';
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
        services?: any[];
    },
    gts?: GtsConfig
}

/**
 * Gts provider
 */
export const provideGts = (config: GtsProviderConfig): Array<Provider | EnvironmentProviders> =>
{
    // Base providers
    const providers: Array<Provider | EnvironmentProviders> = [
        {
            // Disable 'theme' sanity check
            provide : MATERIAL_SANITY_CHECKS,
            useValue: {
                doctype: true,
                theme  : false,
                version: true,
            },
        },
        {
            // Use the 'fill' appearance on Angular Material form fields by default
            provide : MAT_FORM_FIELD_DEFAULT_OPTIONS,
            useValue: {
                appearance: 'fill',
            },
        },
        {
            provide : GTS_MOCK_API_DEFAULT_DELAY,
            useValue: config?.mockApi?.delay ?? 0,
        },
        {
            provide : GTS_CONFIG,
            useValue: config?.gts ?? {},
        },

        importProvidersFrom(MatDialogModule),
        {
            provide : ENVIRONMENT_INITIALIZER,
            useValue: () => inject(GtsConfirmationService),
            multi   : true,
        },

        provideHttpClient(withInterceptors([gtsLoadingInterceptor])),
        {
            provide : ENVIRONMENT_INITIALIZER,
            useValue: () => inject(GtsLoadingService),
            multi   : true,
        },

        {
            provide : ENVIRONMENT_INITIALIZER,
            useValue: () => inject(GtsMediaWatcherService),
            multi   : true,
        },
        {
            provide : ENVIRONMENT_INITIALIZER,
            useValue: () => inject(GtsPlatformService),
            multi   : true,
        },
        {
            provide : ENVIRONMENT_INITIALIZER,
            useValue: () => inject(GtsSplashScreenService),
            multi   : true,
        },
        {
            provide : ENVIRONMENT_INITIALIZER,
            useValue: () => inject(GtsUtilsService),
            multi   : true,
        },
    ];

    // Mock Api services
    if ( config?.mockApi?.services )
    {
        providers.push(
            provideHttpClient(withInterceptors([mockApiInterceptor])),
            {
                provide   : APP_INITIALIZER,
                deps      : [...config.mockApi.services],
                useFactory: () => (): any => null,
                multi     : true,
            },
        );
    }

    // Return the providers
    return providers;
};
