import { Module } from '@nestjs/common';
import { ApsController } from './aps.controller';
import { BmmsMasterModule } from '../bms/bms.module';
import { ApsService } from './aps.service';

@Module({
    imports: [BmmsMasterModule],
    controllers: [ApsController],
    providers: [ApsService],
    exports: [ApsService]
})
export class ApsModule { }
