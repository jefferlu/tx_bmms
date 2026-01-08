import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap, catchError, of } from 'rxjs';
import { environment } from 'environments/environment';
import {
    FileListResponse,
    FileItem,
    PermissionInfo,
    UploadResponse,
    ActionRequest,
    ActionResponse,
} from './bim-media-viewer.types';

@Injectable({ providedIn: 'root' })
export class BimMediaViewerService {
    private _httpClient = inject(HttpClient);
    private readonly API_URL = `${environment.apiUrl}/file-manager`;

    // State management
    private _items: BehaviorSubject<FileItem[]> = new BehaviorSubject<FileItem[]>([]);
    private _currentPath: BehaviorSubject<string> = new BehaviorSubject<string>('');
    private _permissions: BehaviorSubject<PermissionInfo> = new BehaviorSubject<PermissionInfo>({
        can_read: false,
        can_write: false
    });
    private _loading: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    private _error: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

    // Observables
    get items$(): Observable<FileItem[]> {
        return this._items.asObservable();
    }

    get currentPath$(): Observable<string> {
        return this._currentPath.asObservable();
    }

    get permissions$(): Observable<PermissionInfo> {
        return this._permissions.asObservable();
    }

    get loading$(): Observable<boolean> {
        return this._loading.asObservable();
    }

    get error$(): Observable<string | null> {
        return this._error.asObservable();
    }

    /**
     * 取得檔案列表
     */
    listFiles(path: string = ''): Observable<FileListResponse> {
        this._loading.next(true);
        this._error.next(null);

        const params = new HttpParams().set('path', path);

        return this._httpClient
            .get<FileListResponse>(`${this.API_URL}/list/`, { params })
            .pipe(
                tap((response) => {
                    this._items.next(response.items);
                    this._currentPath.next(response.current_path);
                    this._permissions.next(response.permissions);
                    this._loading.next(false);
                }),
                catchError((error) => {
                    this._error.next(this._handleError(error));
                    this._loading.next(false);
                    throw error;
                })
            );
    }

    /**
     * 上傳檔案
     */
    uploadFiles(path: string, files: File[]): Observable<UploadResponse> {
        this._loading.next(true);
        this._error.next(null);

        const formData = new FormData();
        formData.append('path', path);

        files.forEach((file) => {
            formData.append('file', file, file.name);
        });

        return this._httpClient
            .post<UploadResponse>(`${this.API_URL}/upload/`, formData)
            .pipe(
                tap(() => {
                    this._loading.next(false);
                    // 重新載入當前目錄
                    this.listFiles(this._currentPath.value).subscribe();
                }),
                catchError((error) => {
                    this._error.next(this._handleError(error));
                    this._loading.next(false);
                    throw error;
                })
            );
    }

    /**
     * 執行檔案操作
     */
    performAction(request: ActionRequest): Observable<ActionResponse> {
        this._loading.next(true);
        this._error.next(null);

        return this._httpClient
            .post<ActionResponse>(`${this.API_URL}/action/`, request)
            .pipe(
                tap(() => {
                    this._loading.next(false);
                    // 重新載入當前目錄
                    this.listFiles(this._currentPath.value).subscribe();
                }),
                catchError((error) => {
                    this._error.next(this._handleError(error));
                    this._loading.next(false);
                    throw error;
                })
            );
    }

    /**
     * 刪除檔案或目錄
     */
    deleteItem(path: string): Observable<ActionResponse> {
        return this.performAction({
            action: 'delete',
            path: path,
        });
    }

    /**
     * 重新命名檔案或目錄
     */
    renameItem(path: string, newName: string): Observable<ActionResponse> {
        return this.performAction({
            action: 'rename',
            path: path,
            new_name: newName,
        });
    }

    /**
     * 移動檔案或目錄
     */
    moveItem(sourcePath: string, destPath: string): Observable<ActionResponse> {
        return this.performAction({
            action: 'move',
            path: sourcePath,
            new_path: destPath,
        });
    }

    /**
     * 建立資料夾
     */
    createFolder(path: string, folderName: string): Observable<ActionResponse> {
        return this.performAction({
            action: 'mkdir',
            path: path,
            new_name: folderName,
        });
    }

    /**
     * 下載檔案
     */
    downloadFile(path: string): void {
        const url = `${this.API_URL}/download/?path=${encodeURIComponent(path)}`;
        window.open(url, '_blank');
    }

    /**
     * 取得權限資訊
     */
    getPermissions(): Observable<PermissionInfo> {
        return this._httpClient
            .get<PermissionInfo>(`${this.API_URL}/permissions/`)
            .pipe(
                tap((permissions) => {
                    this._permissions.next(permissions);
                }),
                catchError((error) => {
                    this._error.next(this._handleError(error));
                    throw error;
                })
            );
    }

    /**
     * 導航到指定路徑
     */
    navigateTo(path: string): void {
        this.listFiles(path).subscribe();
    }

    /**
     * 返回上層目錄
     */
    goBack(): void {
        const currentPath = this._currentPath.value;
        if (!currentPath) {
            return;
        }

        const parts = currentPath.split('/').filter((p) => p);
        parts.pop();
        const parentPath = parts.join('/');

        this.navigateTo(parentPath);
    }

    /**
     * 返回根目錄
     */
    goToRoot(): void {
        this.navigateTo('');
    }

    /**
     * 錯誤處理
     */
    private _handleError(error: any): string {
        if (error.status === 403) {
            return '您沒有權限執行此操作';
        } else if (error.status === 404) {
            return '檔案或目錄不存在';
        } else if (error.status === 409) {
            return '檔案或目錄已存在';
        } else if (error.status === 413) {
            return '檔案大小超過限制';
        } else if (error.error && error.error.error) {
            return error.error.error;
        } else {
            return '發生錯誤,請稍後再試';
        }
    }
}
