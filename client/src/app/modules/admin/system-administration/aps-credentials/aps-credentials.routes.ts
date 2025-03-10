import { inject } from "@angular/core";
import { Routes } from "@angular/router";
import { ApsCredentialsComponent } from "./aps-credentials.component";


export default [{
    path: '',
    component: ApsCredentialsComponent,
    // resolve: {
    //     data: () => inject(UserActivityLogService).getData()
    // }
}] as Routes;