import { inject } from "@angular/core";
import { Routes } from "@angular/router";

import { FileManagerComponent } from "./file-manager.component";
import { FileManagerListComponent } from "./list/list.component";
import { FileManagerService } from "./file-manager.service";

export default [{
    path: '',
    component: FileManagerComponent,
    resolve: {
        // objects: () => inject(FileManagerService).getObjects()
    },
    children: [{
        path: '',
        component: FileManagerListComponent,
    }]
}] as Routes