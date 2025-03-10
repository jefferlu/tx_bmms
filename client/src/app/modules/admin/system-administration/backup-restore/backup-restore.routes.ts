import { inject } from "@angular/core";
import { Routes } from "@angular/router";
import { BackupRestoreComponent } from "./backup-restore.component";


export default [{
    path: '',
    component: BackupRestoreComponent,
    // resolve: {
    //     data: () => inject(UserActivityLogService).getData()
    // }
}] as Routes;