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
     * 導出 CSV 或 TXT 文件
     * @param format 導出格式 'csv' 或 'txt'
     * @param searchParams 搜索參數
     * @returns Observable<Blob>
     */
    exportData(format: 'csv' | 'txt', searchParams?: any): Observable<Blob> {
        return this._appService.get(
            `core/log-user-activity/export_${format}`,
            searchParams,
            { responseType: 'blob' }
        );
    }
}
