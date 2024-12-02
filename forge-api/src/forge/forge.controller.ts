import { Body, Controller, Post, Query, Res, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ForgeService } from './forge.service';

@Controller('')
export class ForgeController {

    constructor(private _forgeService: ForgeService) { }

    @Post('objects')
    getObjects(@Body() credentials: any) {
        console.log('objects')
        return this._forgeService.getObjects(credentials)
    }

    @Post('object')
    getObject(@Body() request: any) {
        return this._forgeService.getObject(request.name)
    }

    @Sse('upload-object')
    uploadObject(
        @Query('name') name: string,
        @Query('clientId') clientId: string,
        @Query('clientSecret') clientSecret: string,
        @Query('bucketKey') bucketKey: string,
        @Res() res: Response
    ): Observable<MessageEvent> {
        return this._forgeService.uploadObject(name, {
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
        console.log('translate-job')
        return this._forgeService.translateJob(name, {
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

        return this._forgeService.extractMetadata(name, {
            'clientId': clientId,
            'clientSecret': clientSecret,
            'bucketKey': bucketKey
        });
    }
}
