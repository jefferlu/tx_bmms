import { inject } from "@angular/core";
import { Routes } from "@angular/router";

import { ProcessFunctionsComponent } from "./process-functions.component";
import { ProcessFunctionsService } from "./process-functions.service";
import { ListComponent } from "./list/list.component";

export default [{
    path: '',
    component: ProcessFunctionsComponent,
    resolve: {
        // products: () => inject(ProcessFunctionsService).getProducts()
    },
    children: [{
        path: '',
        component: ListComponent,

    }]
}] as Routes