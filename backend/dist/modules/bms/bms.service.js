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
exports.BmmsMasterService = void 0;
const common_1 = require("@nestjs/common");
const bms_entity_1 = require("./bms.entity");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let BmmsMasterService = class BmmsMasterService {
    constructor(bmmsRepository) {
        this.bmmsRepository = bmmsRepository;
    }
    async exist(data) {
        const { name } = data;
        let exist = await this.findOne(name);
        return exist ? true : false;
    }
    async create(data) {
        let bmms = this.bmmsRepository.create({
            ...data,
        });
        return this.bmmsRepository.save(bmms);
    }
    async update(data) {
        const { name, svfPath } = data;
        let bmms = await this.findOne(name);
        bmms.svfPath = svfPath;
        delete data.svfPath;
        Object.assign(bmms, data);
        return this.bmmsRepository.save(bmms);
    }
    async findAll(name) {
        if (name && Object.keys(name).length > 0) {
            return this.bmmsRepository.find({
                where: { name: (0, typeorm_2.ILike)(`%${name}%`) },
            });
        }
        else {
            console.log(2);
            return this.bmmsRepository.find();
        }
    }
    async findOne(name) {
        return this.bmmsRepository.findOneBy({ name });
    }
};
exports.BmmsMasterService = BmmsMasterService;
exports.BmmsMasterService = BmmsMasterService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(bms_entity_1.Bmms_Master)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], BmmsMasterService);
//# sourceMappingURL=bms.service.js.map