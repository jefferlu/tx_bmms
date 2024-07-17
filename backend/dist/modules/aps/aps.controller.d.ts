import { MessageEvent } from '@nestjs/common';
import { ApsService } from './aps.service';
import { Observable } from 'rxjs';
import { Response } from 'express';
export declare class ApsController {
    private _aps;
    constructor(_aps: ApsService);
    getObjects(): Promise<any>;
    getObject(request: any): Promise<any>;
    uploadObject(name: string, res: Response): Observable<MessageEvent>;
    translateJob(name: string, res: Response): Observable<MessageEvent>;
    extractMetadata(name: string, res: Response): Observable<MessageEvent>;
}
