import { Bmms_Master } from './bms.entity';
import { Repository } from 'typeorm';
export declare class BmmsMasterService {
    private bmmsRepository;
    constructor(bmmsRepository: Repository<Bmms_Master>);
    exist(data: Partial<Bmms_Master>): Promise<boolean>;
    create(data: Partial<Bmms_Master>): Promise<Bmms_Master>;
    update(data: Partial<Bmms_Master>): Promise<Bmms_Master>;
    findAll(name?: string): Promise<Bmms_Master[]>;
    findOne(name: string): Promise<Bmms_Master | undefined>;
}
