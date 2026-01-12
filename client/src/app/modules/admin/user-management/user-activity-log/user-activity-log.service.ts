import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseService } from 'app/core/services/base/base.service';

@Injectable({
    providedIn: 'root'
})
export class UserActivityLogService extends BaseService {

    constructor() {
        super('core/log-user-activity')
    }

    /**
     * 導出 CSV 或 TXT 文件（使用流式響應）
     * @param format 導出格式 'csv' 或 'txt'
     * @param headers 標題數組
     * @param searchParams 搜索參數
     * @returns Observable<Blob>
     */
    exportData(format: 'csv' | 'txt', headers: string[], searchParams?: any): Observable<Blob> {
        const params = {
            ...searchParams,
            headers: headers.join(',')  // 將標題數組轉換為逗號分隔字串
        };

        return this._appService.get(
            `core/log-user-activity/export_${format}`,
            params,
            { responseType: 'blob' }
        );
    }
}
