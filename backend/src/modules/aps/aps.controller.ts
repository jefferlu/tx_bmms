import { Body, Controller, Get, MessageEvent, Param, Post, Query, Req, Res, Sse } from '@nestjs/common';
import { Observable, interval, map } from 'rxjs';
import { Response } from 'express';
import { ApsService } from './aps.service';

@Controller('api/aps')
export class ApsController {

    constructor(private _aps: ApsService) { }

    @Post('objects')
    getObjects(@Body() credentials: any) {
        return this._aps.getObjects(credentials)
    }

    @Post('object')
    getObject(@Body() request: any) {
        return this._aps.getObject(request.name)
    }

    @Sse('upload-object')
    uploadObject(
        @Query('name') name: string,
        @Query('clientId') clientId: string,
        @Query('clientSecret') clientSecret: string,
        @Query('bucketKey') bucketKey: string,
        @Res() res: Response
    ): Observable<MessageEvent> {
        return this._aps.uploadObject(name, {
            'clientId': clientId,
            'clientSecret': clientSecret,
            'bucketKey': bucketKey
        });
    }

    @Sse('translate-job')
    translateJob(
        @Query('name') name: string,
        @Query('clientId') clientId: string,
        @Query('clientSecret') clientSecret: string,
        @Query('bucketKey') bucketKey: string,
        @Res() res: Response
    ): Observable<MessageEvent> {
        return this._aps.translateJob(name, {
            'clientId': clientId,
            'clientSecret': clientSecret,
            'bucketKey': bucketKey
        });
    }

    @Sse('extract-metadata')
    extractMetadata(
        @Query('name') name: string,
        @Query('clientId') clientId: string,
        @Query('clientSecret') clientSecret: string,
        @Query('bucketKey') bucketKey: string,
        @Res() res: Response
    ): Observable<MessageEvent> {

        return this._aps.extractMetadata(name, {
            'clientId': clientId,
            'clientSecret': clientSecret,
            'bucketKey': bucketKey
        });
    }
}


