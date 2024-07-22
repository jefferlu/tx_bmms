import { Body, Controller, Get, MessageEvent, Param, Post, Req, Res, Sse } from '@nestjs/common';
import { Observable, interval, map } from 'rxjs';
import { Response } from 'express';
import { ApsService } from './aps.service';

@Controller('api/aps')
export class ApsController {

    constructor(private _aps: ApsService) { }

    @Get('objects')
    getObjects() {
        return this._aps.getObjects()
    }

    @Post('object')
    getObject(@Body() request: any) {
        return this._aps.getObject(request.name)
    }

    @Sse('upload-object/:name')
    uploadObject(@Param('name') name: string, @Res() res: Response): Observable<MessageEvent> {
        return this._aps.uploadObject(name);
    }

    @Sse('translate-job/:name')
    translateJob(@Param('name') name: string, @Res() res: Response): Observable<MessageEvent> {
        return this._aps.translateJob(name);
    }

    @Sse('extract-metadata/:name')
    extractMetadata(@Param('name') name: string, @Res() res: Response): Observable<MessageEvent> {
        
        return this._aps.extractMetadata(name);
    }
}


