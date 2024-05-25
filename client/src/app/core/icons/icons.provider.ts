import { ENVIRONMENT_INITIALIZER, Provider, EnvironmentProviders, inject } from '@angular/core';
import { IconsService } from './icons.service';

export const provideIcons = (): Array<Provider | EnvironmentProviders> => {

    return [{
        provide: ENVIRONMENT_INITIALIZER,
        useValue: () => inject(IconsService),
        multi: true
    }]
}
