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
     * 獲取所有數據（用於導出）
     * @param searchParams 搜索參數
     * @returns Observable with all data
     */
    getAllData(searchParams?: any): Observable<any> {
        const params = {
            ...searchParams,
            size: 10000  // 設置一個很大的數字來獲取所有數據
        };
        return this._appService.get('core/log-user-activity', params);
    }
}
