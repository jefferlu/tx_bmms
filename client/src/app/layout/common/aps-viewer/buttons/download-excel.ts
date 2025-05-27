import { Injector } from "@angular/core";
import { DownloadPanel } from "./download-panel";

export class DownloadExcel extends DownloadPanel {
    constructor(viewer: any, container: HTMLElement, id: string, title: string, injector: Injector) {
        super(viewer, container, id, title, { type: 'csv' }, injector);
    }
}