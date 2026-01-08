import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FileManagerService } from '../file-manager.service';
import { FileItem, PermissionInfo } from '../file-manager.types';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'file-manager-list',
    templateUrl: './list.component.html',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        MatProgressSpinnerModule
    ]
})
export class FileManagerListComponent implements OnInit, OnDestroy {
    private _fileManagerService = inject(FileManagerService);
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    items: FileItem[] = [];
    currentPath: string = '';
    permissions: PermissionInfo = { can_read: false, can_write: false };
    loading: boolean = false;
    error: string | null = null;

    ngOnInit(): void {
        // 訂閱檔案列表
        this._fileManagerService.items$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((items) => {
                this.items = items;
            });

        // 訂閱當前路徑
        this._fileManagerService.currentPath$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((path) => {
                this.currentPath = path;
            });

        // 訂閱權限
        this._fileManagerService.permissions$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((permissions) => {
                this.permissions = permissions;
            });

        // 訂閱載入狀態
        this._fileManagerService.loading$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((loading) => {
                this.loading = loading;
            });

        // 訂閱錯誤
        this._fileManagerService.error$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((error) => {
                this.error = error;
            });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    /**
     * 進入資料夾
     */
    navigateToFolder(item: FileItem): void {
        if (item.type === 'directory') {
            this._fileManagerService.navigateTo(item.path);
        }
    }

    /**
     * 返回上層
     */
    goBack(): void {
        this._fileManagerService.goBack();
    }

    /**
     * 返回根目錄
     */
    goToRoot(): void {
        this._fileManagerService.goToRoot();
    }

    /**
     * 下載檔案
     */
    downloadFile(item: FileItem): void {
        if (item.type === 'file') {
            this._fileManagerService.downloadFile(item.path);
        }
    }

    /**
     * 取得檔案圖示
     */
    getFileIcon(item: FileItem): string {
        if (item.type === 'directory') {
            return 'heroicons_solid:folder';
        }
        return 'heroicons_solid:document';
    }

    /**
     * 格式化檔案大小
     */
    formatSize(bytes: number | null): string {
        if (bytes === null) return '-';
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * 取得資料夾列表
     */
    getFolders(): FileItem[] {
        return this.items.filter(item => item.type === 'directory');
    }

    /**
     * 取得檔案列表
     */
    getFiles(): FileItem[] {
        return this.items.filter(item => item.type === 'file');
    }

    /**
     * Track by 函數
     */
    trackByFn(index: number, item: FileItem): string {
        return item.path;
    }
}
