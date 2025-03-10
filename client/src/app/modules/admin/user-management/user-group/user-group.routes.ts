import { Routes } from "@angular/router";
import { UserGroupComponent } from "./user-group.component";
import { inject } from "@angular/core";
import { PermissionService, UserGroupService } from "./user-group.service";
import { forkJoin } from "rxjs";

export default [{
    path: '',
    component: UserGroupComponent,
    resolve: {
        data: () => forkJoin({
            groups: inject(UserGroupService).getData(),
            permissions: inject(PermissionService).getData()
        })
    }
}] as Routes;