import { Module } from '@nestjs/common';
import { TranslateJobController } from './translate-job.controller';
import { TranslateJobService } from './translate-job.service';

@Module({
    controllers: [TranslateJobController],
    providers: [TranslateJobService]
})
export class TranslateJobModule { }
