import { Module } from '@nestjs/common';
import { BmmsMasterController } from './bms.controller';
import { BmmsMasterService } from './bms.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bmms_Master } from './bms.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Bmms_Master])],
    controllers: [BmmsMasterController],
    providers: [BmmsMasterService],
    exports: [BmmsMasterService]
})
export class BmmsMasterModule { }
