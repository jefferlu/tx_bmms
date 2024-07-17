import { Server, Socket } from 'socket.io';
import { BmmsMasterService } from 'src/modules/bms/bms.service';
export declare class TranslateJobGateway {
    private _bmmsMasterService;
    constructor(_bmmsMasterService: BmmsMasterService);
    handleMessage(client: any, payload: any): string;
    server: Server;
    uploadObject(data: any, client: Socket): void;
    handleTranslateEvent(data: any, client: Socket): void;
    extractMetadata(data: any, client: Socket): void;
    private _upload;
    private _translateObjectCustom;
    private _extract;
    private _extractDerivative;
}
