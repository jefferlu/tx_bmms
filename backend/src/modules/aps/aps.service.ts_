import * as path from 'path';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as crypto from 'crypto';

import { Injectable, MessageEvent } from '@nestjs/common';
import { IEnvironment } from './environments';
import { IContext, findViewable, getModelDerivativeClientForObject, getURN, promptBucket, promptDerivative, promptObject, showErrorMessage } from './common';
import { AuthenticationClient, BIM360Client, DataManagementClient, IDerivativeOutputType, IResumableUploadRange, ModelDerivativeClient, WebhooksClient } from 'forge-server-utils';
import { Observable } from 'rxjs';
import { SvfDownloader } from 'forge-convert-utils';
import { BmmsMasterService } from '../bms/bms.service';

const fsPath = './uploads';
const outputFolderUri = './downloads';
const bucketKey = 'bmms_oss'

const env: IEnvironment = {
    title: 'bmms',
    clientId: '94MGPGEtqunCJS6XyZAAnztSSIrtfOLsVWQEkLNQ7uracrAC',
    clientSecret: 'G5tBYHoxe9xbpsisxGo5kBZOCPwEFCCuXIYr8kms28SSRuuVAHR0G766A3RKFQXy',
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

@Injectable()
export class ApsService {

    constructor(private _bmmsMasterService: BmmsMasterService) { }

    async getObjects(): Promise<any> {
        try {
            let data = [];
            const objects = await promptObject(context, bucketKey);

            for (const object of objects) {
                let urn = getURN(object);
                let client = getModelDerivativeClientForObject(object, context);
                let manifest;

                // avoid error format
                try {
                    manifest = await client.getManifest(urn);

                    object.status = manifest.status;
                    object.progress = manifest.progress;
                    if (object.status == 'inprogress') object.refresh = true;

                    data.push(object);
                } catch {
                    object.status
                }
            }
            // console.log(objects)
            return objects;
        } catch (err) {
            console.log(err)
            return showErrorMessage('Could not get objects', err);
        }
    }

    async getObject(name: string): Promise<any> {
        try {
            const object = await promptObject(context, bucketKey, name);
            let urn = getURN(object);
            let client = getModelDerivativeClientForObject(object, context);
            let manifest = await client.getManifest(urn);

            object.status = manifest.status;
            object.progress = manifest.progress;
            if (['inprogress', 'pending'].includes(object.status)) object.refresh = true;

            return object;
        } catch (err) {
            return showErrorMessage('Could not get object', err);
        }
    }


    uploadObject(name: string): Observable<MessageEvent> {

        return new Observable((observer) => {
            this._upload(name, observer);
            return () => {
                console.log('return')
            };
        });

    }
    async _upload(name: string, observer: any) {

        const chunkBytes = 2097152;
        const filepath = fsPath + '/' + encodeURIComponent(name);
        const hash = await this.computeFileHash(bucketKey, name, filepath);
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

                observer.next({ data: { status: 'process', progress: Math.round(100 * (lastByte / totalBytes)) } });
                // this.server.emit('upload-object', { lastByte: lastByte, totalBytes: totalBytes, name: name });
                // console.log(lastByte, totalBytes)

            }
            observer.next({ data: { status: 'complete' } });


        } catch (err) {
            showErrorMessage('Could not upload file', err);
        } finally {
            if (fd !== -1) {
                fs.closeSync(fd);
                fd = -1;
            }
        }

    }

    translateJob(name: string): Observable<MessageEvent> {
        return new Observable((observer) => {
            this._translate(name, observer);
            return () => { };
        });
    }
    async _translate(name: string, observer: any) {
        try {
            const bucket = await promptBucket(context, bucketKey);
            if (!bucket) {
                return;
            }

            const object = await promptObject(context, bucket.bucketKey, name);
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

            let second = 1;
            const intervalId = setInterval(async () => {
                const manifest = await client.getManifest(urn);
                // this.server.emit('translate-job', { status: manifest.status, progress: manifest.progress.split(' ')[0] + ` (${second++}s)` });
                observer.next({ data: { status: manifest.status, progress: manifest.progress.split(' ')[0] } });

                if (manifest.status === 'success') clearInterval(intervalId);
            }, 1000);

        } catch (error) {
            // showErrorMessage('Could not translate object', err);
            let message = '';
            if (error?.response?.data?.diagnostic) message = error.response.data.diagnostic
            observer.next({ data: { status: 'failed', progress: message } });
            // this.server.emit('upload-object', { error: error });
        }
    }

    extractMetadata(name: string): Observable<MessageEvent> {
        return new Observable((observer) => {
            this._extract(name, observer);
            return () => {
            };
        });
    }
    async _extract(name: string, observer: any) {
        try {
            const bucket = await promptBucket(context, bucketKey);
            if (!bucket) {
                return;
            }

            const object = await promptObject(context, bucket.bucketKey, name);
            if (!object) {
                return;
            }

            const filepath = fsPath + '/' + encodeURIComponent(name)
            const baseDir = outputFolderUri;
            const urn = getURN(object);

            const svfDownloader = new SvfDownloader(context.credentials);
            const svfDownloadTask = svfDownloader.download(urn, {
                outputDir: baseDir,
                log: (message: string) => {

                    // if (message.includes('output.svf')) console.log(message);
                    observer.next({ data: { status: 'extract', message: message } });
                    console.log(message)
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
                // await fse.remove(record.svfPath);                
                this._bmmsMasterService.update(master_data);
            }
            else {
                this._bmmsMasterService.create(master_data);
            }

            observer.next({ data: { status: 'complete', message: 'extract completed' } });
            console.log('extract completed');

        } catch (error) {
            console.log(error);
            observer.next({ data: { error: error } });

        }
    }


    private computeFileHash(bucketKey: string, objectKey: string, filename: string): Promise<string> {
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
}
