import { Injectable } from '@angular/core';
import { BaseService } from 'app/core/services/base/base.service';

@Injectable({
    providedIn: 'root'
})
export class UserGroupService extends BaseService {

    constructor() {
        super('core/groups')
    }
}

@Injectable({
    providedIn: 'root'
})
export class PermissionService extends BaseService {

    constructor() {
        super('core/permissions')
    }
}
