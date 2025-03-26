import { inject } from "@angular/core";
import { Routes } from "@angular/router";
import { BimModelViewerComponent } from "./bim-model-viewer.component";
import { BimModelViewerService } from "./bim-model-viewer.service";

export default [{
    path: '',
    component: BimModelViewerComponent,
    resolve: {
        data: () => inject(BimModelViewerService).getData()
    },
}] as Routes;