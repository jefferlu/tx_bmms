import { inject } from "@angular/core";
import { Routes } from "@angular/router";
import { BackupRestoreComponent } from "./backup-restore.component";
import { BackupRestoreService } from "./backup-restore.service";


export default [{
    path: '',
    component: BackupRestoreComponent,
    resolve: {
        data: () => inject(BackupRestoreService).getData('core/latest-backup')
    }
}] as Routes;