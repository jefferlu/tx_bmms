import { inject } from "@angular/core";
import { Routes } from "@angular/router";
import { BimDataImportComponent } from "./bim-data-import.component";
import { BimDataImportService } from "./bim-data-import.service";
import { of } from "rxjs";


export default [{
    path: '',
    component: BimDataImportComponent,
    resolve: {
        data: () => {
            const bimDataImportService = inject(BimDataImportService);
            if (bimDataImportService.hasObjectsData)
                return of(true)
            return bimDataImportService.getObjects();
        }
    },
}] as Routes