import { Routes } from "@angular/router";
import { UserManagementComponent } from "./user-management.component";
import { inject } from "@angular/core";
import { UserAccountService } from "./user-account/user-account.service";

export default [{
    path: '', component: UserManagementComponent,
    resolve: {
        users: () => inject(UserAccountService).list()
    }

}] as Routes