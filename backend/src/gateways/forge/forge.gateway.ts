import * as path from 'path';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as crypto from 'crypto';

import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer, WsResponse } from '@nestjs/websockets';
import { AuthenticationClient, BIM360Client, DataManagementClient, IBucket, IDerivativeOutputType, IDerivativeTree, IObject, IResumableUploadRange, ModelDerivativeClient, WebhooksClient, urnify } from 'forge-server-utils';
import { SvfDownloader } from 'forge-convert-utils';

import { Server, Socket } from 'socket.io';
import { IContext } from 'src/forge/common';
import { IEnvironment } from 'src/forge/environment';
import { clearInterval } from 'timers';
import { BmmsMasterService } from 'src/modules/bms/bms.service';



const fsPath = './uploads';
const outputFolderUri = './downloads';
const bucketKey = 'bmms_oss'

const env: IEnvironment = {
    title: 'bmms',
    clientId: '47aKP8JTOibKQTvtpdugm8r05baqLxtF',
    clientSecret: 'UOnLHJkAYTAQAAAP',
    region: 'US'
}

const context: IContext = {
    credentials: { client_id: env.clientId, client_secret: env.clientSecret },
    environment: env,
    authenticationClient: new AuthenticationClient(env.clientId, env.clientSecret, env.host),
    dataManagementClient: new DataManagementClient({ client_id: env.clientId, client_secret: env.clientSecret }),
    modelDerivativeClient2L: new ModelDerivativeClient({ client_id: env.clientId, client_secret: env.clientSecret }),
    modelDerivativeClient3L: new ModelDerivativeClient({ token: '' }),
    webhookClient: new WebhooksClient({ client_id: env.clientId, client_secret: env.clientSecret }),
    bim360Client: new BIM360Client({ client_id: env.clientId, client_secret: env.clientSecret })
};

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class TranslateJobGateway {
    constructor(private _bmmsMasterService: BmmsMasterService) { }

    @SubscribeMessage('message')
    handleMessage(client: any, payload: any): string {
        return 'Hello world!';
    }

    @WebSocketServer()
    server: Server;

    @SubscribeMessage('upload-object')
    uploadObject(@MessageBody() data: any, @ConnectedSocket() client: Socket): void {
        this._upload(data.file);
    }

    @SubscribeMessage('translate-job')
    handleTranslateEvent(@MessageBody() data: any, @ConnectedSocket() client: Socket): void {
        // 在這裡執行 translate 的邏輯，例如模擬一段時間後發送不同的訊息
        // console.log(`Handling translate event... ${data.file}`);
        // this.server.emit('message', { message: `Handling translate event... ${data.file}` });

        // 執行邏輯        
        this._translateObjectCustom(data.file);
    }

    @SubscribeMessage('extract-metadata')
    extractMetadata(@MessageBody() data: any, @ConnectedSocket() client: Socket): void {
        console.log(data)
        this._extract(data.file);
        // this._extractDerivative(data.file);
    }


    private async _upload(originalname: string) {

        function computeFileHash(bucketKey: string, objectKey: string, filename: string): Promise<string> {
            return new Promise((resolve, reject) => {
                const stream = fs.createReadStream(filename);
                let hash = crypto.createHash('md5');
                hash.update(bucketKey);
                hash.update(objectKey);
                stream.on('data', (chunk) => {
                    hash.update(chunk);
                });
                stream.on('end', () => {
                    resolve(hash.digest('hex'));
                });
                stream.on('error', (err) => {
                    reject(err);
                });
            })
        }

        async function showErrorMessage(title: string, err: any) {
            let msg = title;
            if (typeof err === 'string') {
                msg += ': ' + err;
            } else if (typeof err === 'object') {
                if (err.message) {
                    msg += ': ' + err.message;
                }
            }
        }

        try {
            let env: IEnvironment = {
                title: 'bmms',
                clientId: '47aKP8JTOibKQTvtpdugm8r05baqLxtF',
                clientSecret: 'UOnLHJkAYTAQAAAP',
                region: 'US'
            }

            const context: IContext = {
                credentials: { client_id: env.clientId, client_secret: env.clientSecret },
                environment: env,
                authenticationClient: new AuthenticationClient(env.clientId, env.clientSecret, env.host),
                dataManagementClient: new DataManagementClient({ client_id: env.clientId, client_secret: env.clientSecret }),
                modelDerivativeClient2L: new ModelDerivativeClient({ client_id: env.clientId, client_secret: env.clientSecret }),
                modelDerivativeClient3L: new ModelDerivativeClient({ token: '' }),
                webhookClient: new WebhooksClient({ client_id: env.clientId, client_secret: env.clientSecret }),
                bim360Client: new BIM360Client({ client_id: env.clientId, client_secret: env.clientSecret })
            };


            const chunkBytes = 2097152;
            const filepath = fsPath + '/' + encodeURIComponent(originalname)
            const name = originalname;
            const hash = await computeFileHash(bucketKey, name, filepath);
            const stateKey = `upload:${hash}`;
            let fd = -1;

            try {
                fd = fs.openSync(filepath, 'r');
                const totalBytes = fs.statSync(filepath).size;
                const buff = Buffer.alloc(chunkBytes);
                let lastByte = 0;
                let cancelled = false;

                let uploadSessionID = crypto.randomBytes(8).toString('hex');
                let ranges: IResumableUploadRange[];
                try {
                    ranges = await context.dataManagementClient.getResumableUploadStatus(bucketKey, name, uploadSessionID);
                } catch (err) {
                    ranges = [];
                }

                for (const range of ranges) {
                    if (cancelled) {
                        return;
                    }
                    while (lastByte < range.start) {
                        if (cancelled) {
                            return;
                        }
                        const chunkSize = Math.min(range.start - lastByte, chunkBytes);
                        fs.readSync(fd, buff, 0, chunkSize, lastByte);
                        await context.dataManagementClient.uploadObjectResumable(bucketKey, name, buff.subarray(0, chunkSize), lastByte, totalBytes, uploadSessionID);
                        lastByte += chunkSize;
                    }
                    lastByte = range.end + 1;
                }

                while (lastByte < totalBytes - 1) {
                    if (cancelled) {
                        return;
                    }
                    const chunkSize = Math.min(totalBytes - lastByte, chunkBytes);
                    fs.readSync(fd, buff, 0, chunkSize, lastByte);
                    await context.dataManagementClient.uploadObjectResumable(bucketKey, name, buff.subarray(0, chunkSize), lastByte, totalBytes, uploadSessionID);
                    lastByte += chunkSize;

                    this.server.emit('upload-object', { lastByte: lastByte, totalBytes: totalBytes, name: name });

                }


            } catch (err) {
                showErrorMessage('Could not upload file', err);
            } finally {
                if (fd !== -1) {
                    fs.closeSync(fd);
                    fd = -1;
                }
            }
        } catch (error) {
            console.log(error)
            this.server.emit('upload-object', { error: error });
        }
    }

    private async _translateObjectCustom(originalname: string) {

        async function promptBucket(context: IContext): Promise<IBucket | undefined> {
            const buckets = await context.dataManagementClient.listBuckets();
            return buckets.find(item => item.bucketKey === bucketKey);
        }

        async function promptObject(context: IContext, bucketKey: string): Promise<IObject | undefined> {
            const objects = await context.dataManagementClient.listObjects(bucketKey);
            const objectKey = originalname;

            return objects.find(item => item.objectKey === objectKey);
        }

        function getURN(object: IObject): string {
            return urnify(object.objectId).replace('/', '_');
        }

        function getModelDerivativeClientForObject(object: IObject, context: IContext): ModelDerivativeClient {
            if ('objectId' in object) { //IObject
                return context.modelDerivativeClient2L;
            }
        }

        try {
            const bucket = await promptBucket(context);
            if (!bucket) {
                return;
            }

            const object = await promptObject(context, bucket.bucketKey);
            if (!object) {
                return;
            }

            let urn = getURN(object);
            let client = getModelDerivativeClientForObject(object, context);

            const outputOptions = {
                type: 'svf',
                views: ['2d', '3d']
            } as IDerivativeOutputType;

            await client.submitJob(
                urn,
                [outputOptions],
                '',
                true,
            );

            // const manifest = await client.getManifest(urn);
            // console.log(manifest.status);

            let second = 1;
            const intervalId = setInterval(async () => {
                const manifest = await client.getManifest(urn);
                this.server.emit('translate-job', { status: manifest.status, progress: manifest.progress.split(' ')[0] + ` (${second++}s)` });
                if (manifest.status === 'success') clearInterval(intervalId);
            }, 1000);



        } catch (error) {
            // showErrorMessage('Could not translate object', err);
            console.log(error);
            this.server.emit('upload-object', { error: error });
        }
    }

    private async _extract(originalname: string) {

        async function promptBucket(context: IContext): Promise<IBucket | undefined> {
            const buckets = await context.dataManagementClient.listBuckets();
            return buckets.find(item => item.bucketKey === bucketKey);
        }

        async function promptObject(context: IContext, bucketKey: string): Promise<IObject | undefined> {
            const objects = await context.dataManagementClient.listObjects(bucketKey);
            const objectKey = originalname;

            return objects.find(item => item.objectKey === objectKey);
        }

        async function promptDerivative(context: IContext, objectId: string): Promise<any | undefined> {
            const urn = urnify(objectId);
            const manifest = await context.modelDerivativeClient2L.getManifest(urn) as any;
            const svf = manifest.derivatives.find((deriv: any) => deriv.outputType === 'svf');
            if (!svf) {
                return undefined;
            }
            const derivatives: any[] = svf.children.filter((child: any) => child.type === 'geometry').map((geometry: any) => {
                return {
                    urn: urn,
                    name: geometry.name,
                    role: geometry.role,
                    guid: geometry.guid,
                    bubble: geometry
                };
            });

            const derivativeName = 'Scene'

            // if (!derivativeName) {
            //     return undefined;
            // } else {
            // return derivatives.find(item => item.name === derivativeName);
            return derivatives[0];
            // }
        }

        function findViewable(derivative: any): any {
            return derivative.bubble.children.find((child: any) => child.role === 'graphics' || child.role === 'pdf-page');
        }

        try {
            // downloadDerivativesSVF
            const bucket = await promptBucket(context);
            if (!bucket) {
                return;
            }

            const object = await promptObject(context, bucket.bucketKey);
            if (!object) {
                return;
            }

            const filepath = fsPath + '/' + encodeURIComponent(originalname)
            const name = originalname;
            const baseDir = outputFolderUri;
            const urn = urnify(object.objectId);



            const svfDownloader = new SvfDownloader(context.credentials);
            const svfDownloadTask = svfDownloader.download(urn, {
                outputDir: baseDir,
                log: (message: string) => {

                    if (message.includes('output.svf')) console.log(message);

                    this.server.emit('extract-metadata', { status: 'inprogress', message: message });
                }
            });
            await svfDownloadTask.ready;

            /* Derivative Tree */
            const derivative = await promptDerivative(context, object.objectId);
            const viewable = findViewable(derivative);
            const { guid } = viewable;
            let svfPath = path.join(baseDir || '.', urn);
            svfPath = path.join(svfPath, guid)

            console.log(urn)
            console.log(guid)
            /* Endr Derivative Tree */

            // ORM
            let master_data = { 'name': name, 'filePath': filepath, 'svfPath': svfPath }
            let exist = await this._bmmsMasterService.exist(master_data)
            if (exist) {
                let record = await this._bmmsMasterService.findOne(name);                
                await fse.remove(record.svfPath);
                this._bmmsMasterService.update(master_data);
            }
            else {
                this._bmmsMasterService.create(master_data);
            }



            this.server.emit('extract-metadata', { status: 'complete', message: 'Extract metadata ompleted.' });
            console.log('Completed');

        } catch (error) {
            console.log(error);
            this.server.emit('extract-metadata', { error: error });
        }
    }


    private async _extractDerivative(originalname: string) {

        // originalname='SL_OM_IN_B.nwd';
        originalname = 'box.ipt';

        async function promptBucket(context: IContext): Promise<IBucket | undefined> {
            const buckets = await context.dataManagementClient.listBuckets();
            return buckets.find(item => item.bucketKey === bucketKey);
        }

        async function promptObject(context: IContext, bucketKey: string): Promise<IObject | undefined> {
            const objects = await context.dataManagementClient.listObjects(bucketKey);
            const objectKey = originalname;

            return objects.find(item => item.objectKey === objectKey);
        }

        async function promptDerivative(context: IContext, objectId: string): Promise<any | undefined> {
            const urn = urnify(objectId);
            const manifest = await context.modelDerivativeClient2L.getManifest(urn) as any;
            const svf = manifest.derivatives.find((deriv: any) => deriv.outputType === 'svf');
            if (!svf) {
                return undefined;
            }
            const derivatives: any[] = svf.children.filter((child: any) => child.type === 'geometry').map((geometry: any) => {
                return {
                    urn: urn,
                    name: geometry.name,
                    role: geometry.role,
                    guid: geometry.guid,
                    bubble: geometry
                };
            });

            const derivativeName = 'Scene'

            if (!derivativeName) {
                return undefined;
            } else {
                // return derivatives.find(item => item.name === derivativeName);
                return derivatives[0];
            }
        }

        function findViewable(derivative: any): any {
            return derivative.bubble.children.find((child: any) => child.role === 'graphics' || child.role === 'pdf-page');
        }

        const bucket = await promptBucket(context);
        if (!bucket) {
            console.log('Bucket not found.')
            return;
        }

        const object = await promptObject(context, bucket.bucketKey);
        if (!object) {
            console.log('Object not found.')
            return;
        }


        const derivative = await promptDerivative(context, object.objectId);
        console.log(derivative)
        const viewable = findViewable(derivative);

        const { urn } = derivative;
        const { guid } = viewable;

        const client = context.modelDerivativeClient2L;
        let forceDownload = false;

        let tree: IDerivativeTree | undefined = undefined;

        try {
            tree = await client.getViewableTree(urn, guid);
            this.server.emit('extract-metadata', { status: 'inprogress', message: JSON.stringify(tree) });
            console.log(JSON.stringify(tree))
        } catch (err: any) {
        }




    }

}
