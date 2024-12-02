import { Module } from '@nestjs/common';
import { ForgeService } from './forge.service';
import { ForgeController } from './forge.controller';

@Module({
    providers: [ForgeService],
    controllers: [ForgeController]
})
export class ForgeModule { }
