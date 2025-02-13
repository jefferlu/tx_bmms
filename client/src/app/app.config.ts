import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, inject, isDevMode, provideAppInitializer } from '@angular/core';
import { PreloadAllModules, provideRouter, withInMemoryScrolling, withPreloading } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { LuxonDateAdapter } from '@angular/material-luxon-adapter';
import { routes } from './app.routes';
import { provideAuth } from './core/auth/auth.provider';
import { provideIcons } from './core/icons/icons.provider';
import { provideGts } from '@gts';
import { mockApiServices } from './mock-api';
import { TranslocoHttpLoader } from './core/transloco/transloco-loader';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { LocaleService } from './core/services/locale/locale.service';

// import { routes } from './app.routes';



export const appConfig: ApplicationConfig = {
    providers: [
        provideAnimations(),
        provideHttpClient(),
        provideRouter(
            routes,
            withPreloading(PreloadAllModules),
            withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })
        ),
        {
            provide: DateAdapter,
            useClass: LuxonDateAdapter
        },
        {
            provide: MAT_DATE_FORMATS,
            useValue: {
                parse: { dateInput: 'D' },
                display: {
                    dateInput: 'DDD',
                    monthYearLabel: 'LLL yyyy',
                    dateA11yLabel: 'DD',
                    monthYearA11yLabel: 'LLLL yyyy',
                }
            }
        },
        // Preload the default language before the app starts to prevent empty/jumping content
        provideAppInitializer(() => {
        const initializerFn = (() => {
                const localeService = inject(LocaleService);
                const translocoService = inject(TranslocoService);           

                return async () => {
                    const availableLangs = await firstValueFrom(localeService.getData());
                    translocoService.setAvailableLangs(availableLangs);

                    const defaultLang = translocoService.getDefaultLang();
                    translocoService.setActiveLang(defaultLang);
                    await firstValueFrom(translocoService.load(defaultLang))
                };
            })();
        return initializerFn();
      }),
        provideAuth(),
        provideIcons(),
        provideGts({
            mockApi: {
                delay: 0,
                services: mockApiServices,
            },
            gts: {
                layout: 'compact',
                scheme: 'dark',
                screens: {
                    sm: '600px',
                    md: '960px',
                    lg: '1280px',
                    xl: '1440px',
                },
                theme: 'theme-default',
                themes: [
                    {
                        id: 'theme-default',
                        name: 'Default',
                    },
                    {
                        id: 'theme-brand',
                        name: 'Brand',
                    },
                    {
                        id: 'theme-teal',
                        name: 'Teal',
                    },
                    {
                        id: 'theme-rose',
                        name: 'Rose',
                    },
                    {
                        id: 'theme-purple',
                        name: 'Purple',
                    },
                    {
                        id: 'theme-amber',
                        name: 'Amber',
                    },
                ],
            },
        }),
        provideTransloco({
            config: {
                availableLangs: [],
                defaultLang: 'en',
                reRenderOnLangChange: true,
                prodMode: !isDevMode(),
            },
            loader: TranslocoHttpLoader,
        }),
        providePrimeNG({
            theme: {
                preset: Aura
            }
        })

    ]
};
