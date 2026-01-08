/**
 * 檔案管理系統 TypeScript 類型定義
 */

export interface FileItem {
    name: string;
    type: 'file' | 'directory';
    size: number | null;
    modified_time: string;
    created_time: string;
    path: string;
    is_writable: boolean;
}

export interface FileListResponse {
    current_path: string;
    items: FileItem[];
    permissions: PermissionInfo;
}

export interface PermissionInfo {
    can_read: boolean;
    can_write: boolean;
}

export interface UploadedFile {
    name: string;
    path: string;
    size: number;
    message: string;
}

export interface FailedFile {
    name: string;
    message: string;
}

export interface UploadResponse {
    success: boolean;
    uploaded_files: UploadedFile[];
    failed_files: FailedFile[];
}

export interface ActionRequest {
    action: 'rename' | 'delete' | 'move' | 'mkdir';
    path: string;
    new_path?: string;
    new_name?: string;
}

export interface ActionResponse {
    success: boolean;
    action: string;
    message: string;
    item?: FileItem;
}
