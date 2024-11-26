import { Injectable } from '@angular/core';
import { GtsDrawerComponent } from '@gts/components/drawer/drawer.component';

@Injectable({providedIn: 'root'})
export class GtsDrawerService
{
    private _componentRegistry: Map<string, GtsDrawerComponent> = new Map<string, GtsDrawerComponent>();

    /**
     * Constructor
     */
    constructor()
    {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Register drawer component
     *
     * @param name
     * @param component
     */
    registerComponent(name: string, component: GtsDrawerComponent): void
    {
        this._componentRegistry.set(name, component);
    }

    /**
     * Deregister drawer component
     *
     * @param name
     */
    deregisterComponent(name: string): void
    {
        this._componentRegistry.delete(name);
    }

    /**
     * Get drawer component from the registry
     *
     * @param name
     */
    getComponent(name: string): GtsDrawerComponent | undefined
    {
        return this._componentRegistry.get(name);
    }
}
