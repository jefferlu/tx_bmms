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
            regions: inject(ProcessFunctionsService).getRegions(),
            conditions: inject(ProcessFunctionsService).getConditions(),
            cobies: inject(ProcessFunctionsService).getCobieData(),
            cobieDef: inject(ProcessFunctionsService).getCobieDef(),
        })
    }
}] as Routes