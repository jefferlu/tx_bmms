import { inject } from "@angular/core";
import { Routes } from "@angular/router";
import { SystemActivityLogComponent } from "./system-activity-log.component";


export default [{
    path: '',
    component: SystemActivityLogComponent,
    // resolve: {
    //     data: () => inject(UserActivityLogService).getData()
    // }
}] as Routes;