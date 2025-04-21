import { Routes } from "@angular/router";

import { ProcessFunctionsComponent } from "./process-functions.component";
import { ProcessFunctionsService } from "./process-functions.service";
import { inject } from "@angular/core";
import { forkJoin } from "rxjs";

export default [{
    path: '',
    component: ProcessFunctionsComponent,
    resolve: {
        data: () => forkJoin({
            conditions: inject(ProcessFunctionsService).getConditions(),
        })
    }
}] as Routes