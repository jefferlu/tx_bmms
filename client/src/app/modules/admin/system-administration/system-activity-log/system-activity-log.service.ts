import { Injectable } from '@angular/core';
import { BaseService } from 'app/core/services/base/base.service';

@Injectable({
    providedIn: 'root'
})
export class SystemActivityLogService extends BaseService {

    constructor() {
        super('core/log-system-activity')
    }

}
