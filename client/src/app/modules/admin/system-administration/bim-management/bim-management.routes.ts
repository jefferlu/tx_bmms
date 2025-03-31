import { inject } from "@angular/core";
import { Routes } from "@angular/router";
import { BimManagementComponent } from "./bim-management.component";
import { BimManagementService } from "./bim-management.service";

export default [{
    path: '',
    component: BimManagementComponent,
    resolve: {
        data: () => inject(BimManagementService).getData()
    },
}] as Routes;