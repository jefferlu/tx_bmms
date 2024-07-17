import { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { BmmsMasterService } from '../bms/bms.service';
export declare class ApsService {
    private _bmmsMasterService;
    constructor(_bmmsMasterService: BmmsMasterService);
    getObjects(): Promise<any>;
    getObject(name: string): Promise<any>;
    uploadObject(name: string): Observable<MessageEvent>;
    _upload(name: string, observer: any): Promise<void>;
    translateJob(name: string): Observable<MessageEvent>;
    _translate(name: string, observer: any): Promise<void>;
    extractMetadata(name: string): Observable<MessageEvent>;
    _extract(name: string, observer: any): Promise<void>;
    private computeFileHash;
}
