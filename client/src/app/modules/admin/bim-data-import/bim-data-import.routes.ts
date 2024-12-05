import { inject } from "@angular/core";
import { Routes } from "@angular/router";
import { BimDataImportComponent } from "./bim-data-import.component";
import { BimDataImportService } from "./bim-data-import.service";


export default [{
    path: '',
    component: BimDataImportComponent,
    resolve: {
        // data: () => inject(BimDataImportService).getBuckets()
    }
}] as Routes