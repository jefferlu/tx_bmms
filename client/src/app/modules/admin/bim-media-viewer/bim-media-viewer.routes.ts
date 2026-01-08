import { Routes } from '@angular/router';
import { BimMediaViewerComponent } from './bim-media-viewer.component';
import { BimMediaViewerListComponent } from './list/list.component';
import { inject } from '@angular/core';
import { BimMediaViewerService } from './bim-media-viewer.service';

export default [
    {
        path: '',
        component: BimMediaViewerComponent,
        children: [
            {
                path: '',
                component: BimMediaViewerListComponent,
                resolve: {
                    items: () => inject(BimMediaViewerService).listFiles('')
                }
            }
        ]
    }
] as Routes;
