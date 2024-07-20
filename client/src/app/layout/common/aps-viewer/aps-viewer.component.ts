import { AfterViewInit, Component, ElementRef, Inject, Input, OnDestroy, OnInit, Optional, ViewChild, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { environment } from 'environments/environment';

declare const Autodesk: any;
const env = environment;

@Component({
    selector: 'aps-viewer',
    templateUrl: './aps-viewer.component.html',
    styleUrl: './aps-viewer.component.scss',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [],
})
export class ApsViewerComponent implements OnInit, AfterViewInit, OnDestroy {

    @Input() option;
    @ViewChild('viewer') viewerContainer: ElementRef;

    viewer: any;
    options: any;

    constructor(@Optional() @Inject(MAT_DIALOG_DATA) public data: any) { }

    ngOnInit(): void { }

    ngAfterViewInit(): void {

        let data = this.data || this.option;

        const container = this.viewerContainer.nativeElement;
        this.viewer = new Autodesk.Viewing.Private.GuiViewer3D(container);

        let svfPath = data.svfPath.replace(/\\/g, '/');
        this.options = {
            env: 'Local',
            useConsolidation: true,
            document: `${svfPath}/output.svf`,
            language: 'en',
        };

        // console.log(this.options)

        Autodesk.Viewing.Initializer(this.options, () => {
            Autodesk.Viewing.Private.InitParametersSetting.alpha = true;
            const startedCode = this.viewer.start(this.options.document, this.options, () => {
                this.viewer.impl.invalidate(true);
                this.viewer.setGhosting(false);
            });
        });
    }

    ngOnDestroy(): void {
        console.log('aps-viewer destroy')
        if (this.viewer) {
            this.viewer.finish();
        }
    }
}

