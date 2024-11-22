import { Controller, Get, Query } from '@nestjs/common';
import { BmmsMasterService } from './bms.service';
import { ApiQuery } from '@nestjs/swagger';

@Controller('api/bmms')
export class BmmsMasterController {

    constructor(private _bms: BmmsMasterService) { }

    @Get('list')
    @ApiQuery({ name: 'project', required: false })
    @ApiQuery({ name: 'name', required: false })
    @ApiQuery({ name: 'tags', required: false })
    @ApiQuery({ name: 'cobiename', required: false })
    getList(
        @Query('project',) project: string,
        @Query('name',) name: string,
        @Query('tags') tags?: string,
        @Query('cobiename') cobiename?: string,

    ) {
        return this._bms.findAll(name);
    }


}
