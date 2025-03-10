import { Routes } from "@angular/router";
import { UserManagementComponent } from "./user-management.component";

export default [{
    path: '',
    component: UserManagementComponent,
    children: [
        { path: 'users', loadChildren: () => import('app/modules/admin/user-management/users/users.routes') },
        { path: 'user-group', loadChildren: () => import('app/modules/admin/user-management/user-group/user-group.routes') },
        { path: 'user-activity-log', loadChildren: () => import('app/modules/admin/user-management/user-activity-log/user-activity-log.routes') },
    ]
}] as Routes