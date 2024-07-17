"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApsService = void 0;
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const common_1 = require("@nestjs/common");
const common_2 = require("./common");
const forge_server_utils_1 = require("forge-server-utils");
const rxjs_1 = require("rxjs");
const forge_convert_utils_1 = require("forge-convert-utils");
const bms_service_1 = require("../bms/bms.service");
const fsPath = './uploads';
const outputFolderUri = './downloads';
const bucketKey = 'bmms_oss';
const env = {
    title: 'bmms',
    clientId: '94MGPGEtqunCJS6XyZAAnztSSIrtfOLsVWQEkLNQ7uracrAC',
    clientSecret: 'G5tBYHoxe9xbpsisxGo5kBZOCPwEFCCuXIYr8kms28SSRuuVAHR0G766A3RKFQXy',
    region: 'US'
};
const context = {
    credentials: { client_id: env.clientId, client_secret: env.clientSecret },
    environment: env,
    authenticationClient: new forge_server_utils_1.AuthenticationClient(env.clientId, env.clientSecret, env.host),
    dataManagementClient: new forge_server_utils_1.DataManagementClient({ client_id: env.clientId, client_secret: env.clientSecret }),
    modelDerivativeClient2L: new forge_server_utils_1.ModelDerivativeClient({ client_id: env.clientId, client_secret: env.clientSecret }),
    modelDerivativeClient3L: new forge_server_utils_1.ModelDerivativeClient({ token: '' }),
    webhookClient: new forge_server_utils_1.WebhooksClient({ client_id: env.clientId, client_secret: env.clientSecret }),
    bim360Client: new forge_server_utils_1.BIM360Client({ client_id: env.clientId, client_secret: env.clientSecret })
};
let ApsService = class ApsService {
    constructor(_bmmsMasterService) {
        this._bmmsMasterService = _bmmsMasterService;
    }
    async getObjects() {
        try {
            let data = [];
            const objects = await (0, common_2.promptObject)(context, bucketKey);
            for (const object of objects) {
                let urn = (0, common_2.getURN)(object);
                let client = (0, common_2.getModelDerivativeClientForObject)(object, context);
                let manifest;
                try {
                    manifest = await client.getManifest(urn);
                    object.status = manifest.status;
                    object.progress = manifest.progress;
                    if (object.status == 'inprogress')
                        object.refresh = true;
                    data.push(object);
                }
                catch {
                    object.status;
                }
            }
            return objects;
        }
        catch (err) {
            console.log(err);
            return (0, common_2.showErrorMessage)('Could not get objects', err);
        }
    }
    async getObject(name) {
        try {
            const object = await (0, common_2.promptObject)(context, bucketKey, name);
            let urn = (0, common_2.getURN)(object);
            let client = (0, common_2.getModelDerivativeClientForObject)(object, context);
            let manifest = await client.getManifest(urn);
            object.status = manifest.status;
            object.progress = manifest.progress;
            if (['inprogress', 'pending'].includes(object.status))
                object.refresh = true;
            return object;
        }
        catch (err) {
            return (0, common_2.showErrorMessage)('Could not get object', err);
        }
    }
    uploadObject(name) {
        return new rxjs_1.Observable((observer) => {
            this._upload(name, observer);
            return () => {
                console.log('return');
            };
        });
    }
    async _upload(name, observer) {
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
            let ranges;
            try {
                ranges = await context.dataManagementClient.getResumableUploadStatus(bucketKey, name, uploadSessionID);
            }
            catch (err) {
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
            }
            observer.next({ data: { status: 'complete' } });
        }
        catch (err) {
            (0, common_2.showErrorMessage)('Could not upload file', err);
        }
        finally {
            if (fd !== -1) {
                fs.closeSync(fd);
                fd = -1;
            }
        }
    }
    translateJob(name) {
        return new rxjs_1.Observable((observer) => {
            this._translate(name, observer);
            return () => { };
        });
    }
    async _translate(name, observer) {
        try {
            const bucket = await (0, common_2.promptBucket)(context, bucketKey);
            if (!bucket) {
                return;
            }
            const object = await (0, common_2.promptObject)(context, bucket.bucketKey, name);
            if (!object) {
                return;
            }
            let urn = (0, common_2.getURN)(object);
            let client = (0, common_2.getModelDerivativeClientForObject)(object, context);
            const outputOptions = {
                type: 'svf',
                views: ['2d', '3d']
            };
            await client.submitJob(urn, [outputOptions], '', true);
            let second = 1;
            const intervalId = setInterval(async () => {
                const manifest = await client.getManifest(urn);
                observer.next({ data: { status: manifest.status, progress: manifest.progress.split(' ')[0] } });
                if (manifest.status === 'success')
                    clearInterval(intervalId);
            }, 1000);
        }
        catch (error) {
            let message = '';
            if (error?.response?.data?.diagnostic)
                message = error.response.data.diagnostic;
            observer.next({ data: { status: 'failed', progress: message } });
        }
    }
    extractMetadata(name) {
        return new rxjs_1.Observable((observer) => {
            this._extract(name, observer);
            return () => {
            };
        });
    }
    async _extract(name, observer) {
        try {
            const bucket = await (0, common_2.promptBucket)(context, bucketKey);
            if (!bucket) {
                return;
            }
            const object = await (0, common_2.promptObject)(context, bucket.bucketKey, name);
            if (!object) {
                return;
            }
            const filepath = fsPath + '/' + encodeURIComponent(name);
            const baseDir = outputFolderUri;
            const urn = (0, common_2.getURN)(object);
            const svfDownloader = new forge_convert_utils_1.SvfDownloader(context.credentials);
            const svfDownloadTask = svfDownloader.download(urn, {
                outputDir: baseDir,
                log: (message) => {
                    observer.next({ data: { status: 'extract', message: message } });
                    console.log(message);
                }
            });
            await svfDownloadTask.ready;
            const derivative = await (0, common_2.promptDerivative)(context, object.objectId);
            const viewable = (0, common_2.findViewable)(derivative);
            const { guid } = viewable;
            let svfPath = path.join(baseDir || '.', urn);
            svfPath = path.join(svfPath, guid);
            console.log(urn);
            console.log(guid);
            let master_data = { 'name': name, 'filePath': filepath, 'svfPath': svfPath };
            let exist = await this._bmmsMasterService.exist(master_data);
            if (exist) {
                let record = await this._bmmsMasterService.findOne(name);
                this._bmmsMasterService.update(master_data);
            }
            else {
                this._bmmsMasterService.create(master_data);
            }
            observer.next({ data: { status: 'complete', message: 'extract completed' } });
            console.log('extract completed');
        }
        catch (error) {
            console.log(error);
            observer.next({ data: { error: error } });
        }
    }
    computeFileHash(bucketKey, objectKey, filename) {
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
        });
    }
};
exports.ApsService = ApsService;
exports.ApsService = ApsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [bms_service_1.BmmsMasterService])
], ApsService);
//# sourceMappingURL=aps.service.js.map