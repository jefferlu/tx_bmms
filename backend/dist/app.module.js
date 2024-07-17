"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const users_entity_1 = require("./modules/users/users.entity");
const files_module_1 = require("./modules/files/files.module");
const auth_module_1 = require("./modules/auth/auth.module");
const platform_express_1 = require("@nestjs/platform-express");
const forge_gateway_1 = require("./gateways/forge/forge.gateway");
const translate_job_module_1 = require("./modules/translate-job/translate-job.module");
const bms_module_1 = require("./modules/bms/bms.module");
const bms_entity_1 = require("./modules/bms/bms.entity");
const aps_module_1 = require("./modules/aps/aps.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRoot({
                type: "postgres",
                host: "giantcld.com",
                port: 5432,
                username: "giantcld",
                password: "90637925",
                database: "bmms",
                synchronize: true,
                logging: true,
                entities: [users_entity_1.User, bms_entity_1.Bmms_Master],
                subscribers: [],
                migrations: [],
            }),
            platform_express_1.MulterModule.register({
                dest: './uploads',
            }),
            auth_module_1.AuthModule, files_module_1.FilesModule, translate_job_module_1.TranslateJobModule, bms_module_1.BmmsMasterModule, aps_module_1.ApsModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService, forge_gateway_1.TranslateJobGateway],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map