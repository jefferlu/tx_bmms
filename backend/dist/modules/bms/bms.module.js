"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BmmsMasterModule = void 0;
const common_1 = require("@nestjs/common");
const bms_controller_1 = require("./bms.controller");
const bms_service_1 = require("./bms.service");
const typeorm_1 = require("@nestjs/typeorm");
const bms_entity_1 = require("./bms.entity");
let BmmsMasterModule = class BmmsMasterModule {
};
exports.BmmsMasterModule = BmmsMasterModule;
exports.BmmsMasterModule = BmmsMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([bms_entity_1.Bmms_Master])],
        controllers: [bms_controller_1.BmmsMasterController],
        providers: [bms_service_1.BmmsMasterService],
        exports: [bms_service_1.BmmsMasterService]
    })
], BmmsMasterModule);
//# sourceMappingURL=bms.module.js.map