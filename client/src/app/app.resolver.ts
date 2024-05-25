import { inject } from '@angular/core'
import { ResolveFn } from '@angular/router';
import { forkJoin } from 'rxjs';
import { NavigationService } from './core/navigation/navigation.service';

export const initialDataResolver = () => {
    return forkJoin([
        inject(NavigationService).get(),

    ]);
};

