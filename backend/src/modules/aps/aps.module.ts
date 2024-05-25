import { Module } from '@nestjs/common';
import { ApsController } from './aps.controller';
import { ApsService } from './aps.service';
import { BmmsMasterModule } from '../bms/bms.module';

@Module({
    imports: [BmmsMasterModule],
    controllers: [ApsController],
    providers: [ApsService]
})
export class ApsModule { }
