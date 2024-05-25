import { Controller, Get, Query } from '@nestjs/common';
import { BmmsMasterService } from './bms.service';

@Controller('api/bmms')
export class BmmsMasterController {

    constructor(private _bms: BmmsMasterService) { }

    @Get('list')
    getList(@Query('name') name: string) {
        return this._bms.findAll(name);
    }
}
