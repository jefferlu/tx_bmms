import { Routes } from "@angular/router";

import { ProcessFunctionsComponent } from "./process-functions.component";
import { ProcessFunctionsService } from "./process-functions.service";
import { inject } from "@angular/core";

export default [{
    path: '',
    component: ProcessFunctionsComponent,
    resolve: {
        data: () => inject(ProcessFunctionsService).getCriteria()
    }
}] as Routes