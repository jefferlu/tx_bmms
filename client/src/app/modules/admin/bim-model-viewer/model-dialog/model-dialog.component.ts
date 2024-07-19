import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { environment } from 'environments/environment';

declare const Autodesk: any;
const env = environment;

@Component({
    selector: 'app-model-dialog',
    templateUrl: './model-dialog.component.html',
    styleUrl: './model-dialog.component.scss',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [],
})
export class ModelDialogComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild('viewer') viewerContainer: ElementRef;

    viewer: any;
    options: any;

    constructor(@Inject(MAT_DIALOG_DATA) public data: any) { }


    ngOnInit(): void {
        // console.log(this.data)
    }


    ngAfterViewInit(): void {
        const container = this.viewerContainer.nativeElement;
        this.viewer = new Autodesk.Viewing.Private.GuiViewer3D(container);

        let svfPath = this.data.svfPath.replace(/\\/g, '/');
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
        if (this.viewer) {
            this.viewer.finish();
        }
    }
}
