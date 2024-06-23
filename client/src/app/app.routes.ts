import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { NoAuthGuard } from './core/auth/guards/noAuth.guard';
import { AuthGuard } from './core/auth/guards/auth.guard';
import { initialDataResolver } from './app.resolver';

export const routes: Routes = [

    // Redirect empty path
    { path: '', pathMatch: 'full', redirectTo: 'process-functions' },
    // Redirect signed-in user
    { path: 'signed-in-redirect', pathMatch: 'full', redirectTo: 'process-functions' },

    // Auth routes for guests
    {
        path: '',
        canActivate: [NoAuthGuard],
        component: LayoutComponent,
        data: {
            layout: 'empty'
        },
        children: [
            { path: 'sign-in', loadChildren: () => import('app/modules/auth/sign-in/sign-in.routes') }
        ]
    },

    // Auth routes for authenticated users
    {
        path: '',
        canActivate: [AuthGuard],
        canActivateChild: [AuthGuard],
        component: LayoutComponent,
        resolve: {
            initialData: initialDataResolver
        },
        children: [
            { path: 'process-functions', loadChildren: () => import('app/modules/admin/process-functions/process-functions.routes') },
            { path: 'bmms', loadChildren: () => import('app/modules/admin/bmms/bmms.routes') },
            { path: 'bim-data-import', loadChildren: () => import('app/modules/admin/bim-data-import/bim-data-import.routes') },
            { path: 'user-management', loadChildren: () => import('app/modules/admin/user-management/user-management.routes') },
            { path: 'system-administration', loadChildren: () => import('app/modules/admin/setup/setup.routes') },
        ]

    }
];
