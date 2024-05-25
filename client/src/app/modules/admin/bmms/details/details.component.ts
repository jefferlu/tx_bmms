import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { BmmsService } from '../bmms.service';
import { environment } from 'environments/environment';

declare const Autodesk: any;

const env = environment;

@Component({
    selector: 'bmms-details',
    templateUrl: './details.component.html',
    styleUrl: './details.component.scss',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatButtonModule,
        MatButtonToggleModule
    ],
})
export class BmmsDetailsComponent implements OnInit, OnDestroy {

    object: any;
    viewer: any;
    options: any;

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(private _bs: BmmsService) { }

    ngOnInit(): void {
        
        this._bs.bmmsDetail$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((res) => {

                this.object = res;
                console.log(res)
                const container = document.getElementById('viewer');
                this.viewer = new Autodesk.Viewing.Private.GuiViewer3D(container);
                let svfPath = res.svfPath.replace(/\\/g, '/');
                console.log(`${env.downloadUrl}${svfPath}/output.svf`)
                this.options = {
                    env: 'Local',
                    useConsolidation: true,
                    document: `${env.downloadUrl}${svfPath}/output.svf`,
                    language: 'en'
                };
                Autodesk.Viewing.Initializer(this.options, () => {
                    this.viewer.start(this.options.document, this.options);
                });
            });


    }

    onChange(): void {

        // this.viewer.impl.unloadModel(this.viewer.model);

        // this.options.document = 'assets/building/output.svf';
        this.viewer.loadModel(this.options.document, this.options);
    }

    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    ngOnDestroy(): void {
        if (this.viewer) {
            this.viewer.finish();
        }
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
        console.log('detail destroy')
    }
}
