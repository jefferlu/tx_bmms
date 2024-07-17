import { BmmsMasterService } from './bms.service';
export declare class BmmsMasterController {
    private _bms;
    constructor(_bms: BmmsMasterService);
    getList(name: string): Promise<import("./bms.entity").Bmms_Master[]>;
}
