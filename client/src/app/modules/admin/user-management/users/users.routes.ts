import { inject } from "@angular/core";
import { Routes } from "@angular/router";
import { forkJoin } from "rxjs";
import { UsersComponent } from "./users.component";
import { UsersService } from "./users.service";
import { UserGroupService } from "../user-group/user-group.service";


export default [{
    path: '',
    component: UsersComponent,
    resolve: {
        data: () => forkJoin({
            users: inject(UsersService).getData(),
            groups: inject(UserGroupService).getData()
        })
    }
}] as Routes;