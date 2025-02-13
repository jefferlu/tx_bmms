import { Injectable } from '@angular/core';
import { BaseService } from 'app/core/services/base/base.service';

@Injectable({
    providedIn: 'root'
})
export class ApsCredentialsService extends BaseService {

    constructor() {
        super('core/aps-credentials')
    }

}
