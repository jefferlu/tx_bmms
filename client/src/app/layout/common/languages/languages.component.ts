import { NgFor, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { GtsNavigationItem, GtsNavigationService, GtsVerticalNavigationComponent } from '@gts/components/navigation';
import { GtsConfirmationService } from '@gts/services/confirmation';
import { AvailableLangs, Translation, TranslocoService } from '@jsverse/transloco';
import { LocalStorageService } from 'app/core/services/local-storage/local-storage.service';
import { firstValueFrom, take } from 'rxjs';
import { ToastService } from '../toast/toast.service';
import { LanguagesService } from './languages.service';

@Component({
    selector: 'languages',
    templateUrl: './languages.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    exportAs: 'languages',
    imports: [MatButtonModule, MatMenuModule, NgTemplateOutlet, NgFor, MatIconModule,]
})
export class LanguagesComponent implements OnInit, OnDestroy {
    @ViewChild('fileInput') fileInput!: ElementRef;
    availableLangs: AvailableLangs;
    activeLang: string;

    /**
     * Constructor
     */
    constructor(
        private _translocoService: TranslocoService,
        private _localStorageService: LocalStorageService,
        private _gtsNavigationService: GtsNavigationService,
        private _gtsConfirmationService: GtsConfirmationService,
        private _toastService: ToastService,
        private _languagesService: LanguagesService
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

    triggerFileInput(): void {
        this.fileInput.nativeElement.click();
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) {
            this._toastService.open({
                message: this._translocoService.translate('no-file-selected')
            });
            return;
        }

        const file = input.files[0];
        if (!file.name.toLowerCase().endsWith('.xlsx')) {
            this._toastService.open({
                message: this._translocoService.translate('invalid-file-format')
            });
            input.value = ''; // 清空輸入
            return;
        }


        this._languagesService.upload(file).subscribe({
            next: (response: any) => {
                this._toastService.open({
                    message: this._translocoService.translate('sync-translation-success', { count: response.count }) || response.message
                });
                input.value = ''; // 清空輸入
            },
            error: (error) => {
                if (error.status === 0 || !error.error?.text) {
                    this._toastService.open({
                        message: this._translocoService.translate('upload-failed')
                    });
                    input.value = ''; // 清空輸入
                    return;
                }
                error.error.text().then((errorMessage: string) => {
                    let message: string;
                    try {
                        const errorJson = JSON.parse(errorMessage);
                        message = errorJson.error || errorJson.message || this._translocoService.translate('upload-failed');
                        if (errorJson.details) {
                            message += `: ${errorJson.details.join(', ')}`;
                        }
                    } catch {
                        message = this._translocoService.translate('upload-failed');
                    }
                    this._toastService.open({ message });
                    input.value = ''; // 清空輸入
                }).catch(() => {
                    this._toastService.open({
                        message: this._translocoService.translate('upload-failed')
                    });
                    input.value = ''; // 清空輸入
                });
            }
        });

    }

    onDownload(): void {
        let dialogRef = this._gtsConfirmationService.open({
            title: this._translocoService.translate('confirm-action'),
            message: this._translocoService.translate('download-current-locale-file'),
            icon: { color: 'primary' },
            actions: {
                confirm: { label: this._translocoService.translate('confirm') },
                cancel: { label: this._translocoService.translate('cancel') }
            }

        });

        dialogRef.afterClosed().subscribe(res => {

            if (res === 'confirmed') {
                this._languagesService.download().subscribe({
                    next: (blob: Blob) => {
                        // 創建 Blob 並生成臨時 URL
                        const downloadUrl = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = downloadUrl;
                        link.download = 'translations.xlsx'; // 固定檔案名稱
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(downloadUrl); // 清理臨時 URL
                        this._toastService.open({
                            message: this._translocoService.translate('download-success')
                        });
                    },
                    error: (error) => {
                        // 處理錯誤（例如 HTTP 400, 404, 500）
                        error.error.text().then((errorMessage: string) => {
                            const errorJson = JSON.parse(errorMessage);
                            this._toastService.open({ message: errorJson.error || errorJson.message || '下載失敗，請稍後再試' });
                        }).catch(() => {
                            this._toastService.open({ message: '下載失敗，請聯繫管理員' });
                        });
                    }
                });
            }
        });
    }

    onUpload() {

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
