import { Routes } from '@angular/router';
import { FileManagerComponent } from './file-manager.component';
import { FileManagerListComponent } from './list/list.component';
import { inject } from '@angular/core';
import { FileManagerService } from './file-manager.service';

export default [
    {
        path: '',
        component: FileManagerComponent,
        children: [
            {
                path: '',
                component: FileManagerListComponent,
                resolve: {
                    items: () => inject(FileManagerService).listFiles('')
                }
            }
        ]
    }
] as Routes;
