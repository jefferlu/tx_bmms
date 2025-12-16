import { Routes } from "@angular/router";
import { SystemAdministrationComponent } from "./system-administration.component";

export default [{
    path: '', component: SystemAdministrationComponent,
    children: [
        { path: 'backup-restore', loadChildren: () => import('app/modules/admin/system-administration/backup-restore/backup-restore.routes') },
        { path: 'system-activity-log', loadChildren: () => import('app/modules/admin/system-administration/system-activity-log/system-activity-log.routes') },
        { path: 'aps-credentials', loadChildren: () => import('app/modules/admin/system-administration/aps-credentials/aps-credentials.routes') },
        { path: 'bim-management', loadChildren: () => import('app/modules/admin/system-administration/bim-management/bim-management.routes') },
        { path: 'sensor-bindings', loadChildren: () => import('app/modules/admin/system-administration/sensor-bindings/sensor-bindings.routes') },
    ]
}] as Routes