import { Injectable } from '@nestjs/common';
import { Bmms_Master } from './bms.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Like, Repository } from 'typeorm';
import { UrlWithStringQuery } from 'url';

@Injectable()
export class BmmsMasterService {

    constructor(
        @InjectRepository(Bmms_Master)
        private bmmsRepository: Repository<Bmms_Master>,
    ) { }

    async exist(data: Partial<Bmms_Master>): Promise<boolean> {

        // check user exist
        const { name } = data;
        let exist = await this.findOne(name);
        return exist ? true : false;
        // throw new ConflictException('Email already exists');
    }

    async create(data: Partial<Bmms_Master>): Promise<Bmms_Master> {
        let bmms = this.bmmsRepository.create({
            ...data,

        });
        return this.bmmsRepository.save(bmms);
    }

    async update(data: Partial<Bmms_Master>): Promise<Bmms_Master> {

        const { name, svfPath } = data;

        let bmms = await this.findOne(name);
        bmms.svfPath = svfPath;
        delete data.svfPath;

        Object.assign(bmms, data);
        return this.bmmsRepository.save(bmms);
    }


    // async findAll(condition?: Partial<Bmms_Master>): Promise<Bmms_Master[]> {
    async findAll(name?: string): Promise<Bmms_Master[]> {

        if (name && Object.keys(name).length > 0) {

            return this.bmmsRepository.find({
                where: { name: ILike(`%${name}%`) },
                relations: ['uploader']
            });
        } else {
            console.log(2)
            return this.bmmsRepository.find({ relations: ['uploader'] });
        }
    }

    async findOne(name: string): Promise<Bmms_Master | undefined> {
        return this.bmmsRepository.findOneBy({ name });
    }


}
