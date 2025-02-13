import { Provider, EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { IconsService } from './icons.service';

export const provideIcons = (): Array<Provider | EnvironmentProviders> => {

    return [provideEnvironmentInitializer(() => inject(IconsService))]
}
