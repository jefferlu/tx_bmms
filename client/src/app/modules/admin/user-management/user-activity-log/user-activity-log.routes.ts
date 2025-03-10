import { inject } from "@angular/core";
import { Routes } from "@angular/router";
import { UserActivityLogComponent } from "./user-activity-log.component";
import { UserActivityLogService } from "./user-activity-log.service";


export default [{
    path: '',
    component: UserActivityLogComponent,
    resolve: {
        data: () => inject(UserActivityLogService).getData()
    }
}] as Routes;