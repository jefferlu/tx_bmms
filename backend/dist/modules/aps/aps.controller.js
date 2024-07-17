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
exports.ApsController = void 0;
const common_1 = require("@nestjs/common");
const aps_service_1 = require("./aps.service");
const rxjs_1 = require("rxjs");
let ApsController = class ApsController {
    constructor(_aps) {
        this._aps = _aps;
    }
    getObjects() {
        return this._aps.getObjects();
    }
    getObject(request) {
        return this._aps.getObject(request.name);
    }
    uploadObject(name, res) {
        return this._aps.uploadObject(name);
    }
    translateJob(name, res) {
        return this._aps.translateJob(name);
    }
    extractMetadata(name, res) {
        return this._aps.extractMetadata(name);
    }
};
exports.ApsController = ApsController;
__decorate([
    (0, common_1.Get)('objects'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ApsController.prototype, "getObjects", null);
__decorate([
    (0, common_1.Post)('object'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ApsController.prototype, "getObject", null);
__decorate([
    (0, common_1.Sse)('upload-object/:name'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", rxjs_1.Observable)
], ApsController.prototype, "uploadObject", null);
__decorate([
    (0, common_1.Sse)('translate-job/:name'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", rxjs_1.Observable)
], ApsController.prototype, "translateJob", null);
__decorate([
    (0, common_1.Sse)('extract-metadata/:name'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", rxjs_1.Observable)
], ApsController.prototype, "extractMetadata", null);
exports.ApsController = ApsController = __decorate([
    (0, common_1.Controller)('api/aps'),
    __metadata("design:paramtypes", [aps_service_1.ApsService])
], ApsController);
//# sourceMappingURL=aps.controller.js.map