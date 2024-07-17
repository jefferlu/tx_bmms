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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslateJobGateway = void 0;
const path = require("path");
const fs = require("fs");
const fse = require("fs-extra");
const crypto = require("crypto");
const websockets_1 = require("@nestjs/websockets");
const forge_server_utils_1 = require("forge-server-utils");
const forge_convert_utils_1 = require("forge-convert-utils");
const socket_io_1 = require("socket.io");
const timers_1 = require("timers");
const bms_service_1 = require("../../modules/bms/bms.service");
const fsPath = './uploads';
const outputFolderUri = './downloads';
const bucketKey = 'bmms_oss';
const env = {
    title: 'bmms',
    clientId: '47aKP8JTOibKQTvtpdugm8r05baqLxtF',
    clientSecret: 'UOnLHJkAYTAQAAAP',
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
let TranslateJobGateway = class TranslateJobGateway {
    constructor(_bmmsMasterService) {
        this._bmmsMasterService = _bmmsMasterService;
    }
    handleMessage(client, payload) {
        return 'Hello world!';
    }
    uploadObject(data, client) {
        this._upload(data.file);
    }
    handleTranslateEvent(data, client) {
        this._translateObjectCustom(data.file);
    }
    extractMetadata(data, client) {
        console.log(data);
        this._extract(data.file);
    }
    async _upload(originalname) {
        function computeFileHash(bucketKey, objectKey, filename) {
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
        async function showErrorMessage(title, err) {
            let msg = title;
            if (typeof err === 'string') {
                msg += ': ' + err;
            }
            else if (typeof err === 'object') {
                if (err.message) {
                    msg += ': ' + err.message;
                }
            }
        }
        try {
            let env = {
                title: 'bmms',
                clientId: '47aKP8JTOibKQTvtpdugm8r05baqLxtF',
                clientSecret: 'UOnLHJkAYTAQAAAP',
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
            const chunkBytes = 2097152;
            const filepath = fsPath + '/' + encodeURIComponent(originalname);
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
                    this.server.emit('upload-object', { lastByte: lastByte, totalBytes: totalBytes, name: name });
                }
            }
            catch (err) {
                showErrorMessage('Could not upload file', err);
            }
            finally {
                if (fd !== -1) {
                    fs.closeSync(fd);
                    fd = -1;
                }
            }
        }
        catch (error) {
            console.log(error);
            this.server.emit('upload-object', { error: error });
        }
    }
    async _translateObjectCustom(originalname) {
        async function promptBucket(context) {
            const buckets = await context.dataManagementClient.listBuckets();
            return buckets.find(item => item.bucketKey === bucketKey);
        }
        async function promptObject(context, bucketKey) {
            const objects = await context.dataManagementClient.listObjects(bucketKey);
            const objectKey = originalname;
            return objects.find(item => item.objectKey === objectKey);
        }
        function getURN(object) {
            return (0, forge_server_utils_1.urnify)(object.objectId).replace('/', '_');
        }
        function getModelDerivativeClientForObject(object, context) {
            if ('objectId' in object) {
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
            };
            await client.submitJob(urn, [outputOptions], '', true);
            let second = 1;
            const intervalId = setInterval(async () => {
                const manifest = await client.getManifest(urn);
                this.server.emit('translate-job', { status: manifest.status, progress: manifest.progress.split(' ')[0] + ` (${second++}s)` });
                if (manifest.status === 'success')
                    (0, timers_1.clearInterval)(intervalId);
            }, 1000);
        }
        catch (error) {
            console.log(error);
            this.server.emit('upload-object', { error: error });
        }
    }
    async _extract(originalname) {
        async function promptBucket(context) {
            const buckets = await context.dataManagementClient.listBuckets();
            return buckets.find(item => item.bucketKey === bucketKey);
        }
        async function promptObject(context, bucketKey) {
            const objects = await context.dataManagementClient.listObjects(bucketKey);
            const objectKey = originalname;
            return objects.find(item => item.objectKey === objectKey);
        }
        async function promptDerivative(context, objectId) {
            const urn = (0, forge_server_utils_1.urnify)(objectId);
            const manifest = await context.modelDerivativeClient2L.getManifest(urn);
            const svf = manifest.derivatives.find((deriv) => deriv.outputType === 'svf');
            if (!svf) {
                return undefined;
            }
            const derivatives = svf.children.filter((child) => child.type === 'geometry').map((geometry) => {
                return {
                    urn: urn,
                    name: geometry.name,
                    role: geometry.role,
                    guid: geometry.guid,
                    bubble: geometry
                };
            });
            const derivativeName = 'Scene';
            return derivatives[0];
        }
        function findViewable(derivative) {
            return derivative.bubble.children.find((child) => child.role === 'graphics' || child.role === 'pdf-page');
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
            const filepath = fsPath + '/' + encodeURIComponent(originalname);
            const name = originalname;
            const baseDir = outputFolderUri;
            const urn = (0, forge_server_utils_1.urnify)(object.objectId);
            const svfDownloader = new forge_convert_utils_1.SvfDownloader(context.credentials);
            const svfDownloadTask = svfDownloader.download(urn, {
                outputDir: baseDir,
                log: (message) => {
                    if (message.includes('output.svf'))
                        console.log(message);
                    this.server.emit('extract-metadata', { status: 'inprogress', message: message });
                }
            });
            await svfDownloadTask.ready;
            const derivative = await promptDerivative(context, object.objectId);
            const viewable = findViewable(derivative);
            const { guid } = viewable;
            let svfPath = path.join(baseDir || '.', urn);
            svfPath = path.join(svfPath, guid);
            console.log(urn);
            console.log(guid);
            let master_data = { 'name': name, 'filePath': filepath, 'svfPath': svfPath };
            let exist = await this._bmmsMasterService.exist(master_data);
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
        }
        catch (error) {
            console.log(error);
            this.server.emit('extract-metadata', { error: error });
        }
    }
    async _extractDerivative(originalname) {
        originalname = 'box.ipt';
        async function promptBucket(context) {
            const buckets = await context.dataManagementClient.listBuckets();
            return buckets.find(item => item.bucketKey === bucketKey);
        }
        async function promptObject(context, bucketKey) {
            const objects = await context.dataManagementClient.listObjects(bucketKey);
            const objectKey = originalname;
            return objects.find(item => item.objectKey === objectKey);
        }
        async function promptDerivative(context, objectId) {
            const urn = (0, forge_server_utils_1.urnify)(objectId);
            const manifest = await context.modelDerivativeClient2L.getManifest(urn);
            const svf = manifest.derivatives.find((deriv) => deriv.outputType === 'svf');
            if (!svf) {
                return undefined;
            }
            const derivatives = svf.children.filter((child) => child.type === 'geometry').map((geometry) => {
                return {
                    urn: urn,
                    name: geometry.name,
                    role: geometry.role,
                    guid: geometry.guid,
                    bubble: geometry
                };
            });
            const derivativeName = 'Scene';
            if (!derivativeName) {
                return undefined;
            }
            else {
                return derivatives[0];
            }
        }
        function findViewable(derivative) {
            return derivative.bubble.children.find((child) => child.role === 'graphics' || child.role === 'pdf-page');
        }
        const bucket = await promptBucket(context);
        if (!bucket) {
            console.log('Bucket not found.');
            return;
        }
        const object = await promptObject(context, bucket.bucketKey);
        if (!object) {
            console.log('Object not found.');
            return;
        }
        const derivative = await promptDerivative(context, object.objectId);
        console.log(derivative);
        const viewable = findViewable(derivative);
        const { urn } = derivative;
        const { guid } = viewable;
        const client = context.modelDerivativeClient2L;
        let forceDownload = false;
        let tree = undefined;
        try {
            tree = await client.getViewableTree(urn, guid);
            this.server.emit('extract-metadata', { status: 'inprogress', message: JSON.stringify(tree) });
            console.log(JSON.stringify(tree));
        }
        catch (err) {
        }
    }
};
exports.TranslateJobGateway = TranslateJobGateway;
__decorate([
    (0, websockets_1.SubscribeMessage)('message'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", String)
], TranslateJobGateway.prototype, "handleMessage", null);
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], TranslateJobGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('upload-object'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], TranslateJobGateway.prototype, "uploadObject", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('translate-job'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], TranslateJobGateway.prototype, "handleTranslateEvent", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('extract-metadata'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], TranslateJobGateway.prototype, "extractMetadata", null);
exports.TranslateJobGateway = TranslateJobGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
    }),
    __metadata("design:paramtypes", [bms_service_1.BmmsMasterService])
], TranslateJobGateway);
//# sourceMappingURL=forge.gateway.js.map