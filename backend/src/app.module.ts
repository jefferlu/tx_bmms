import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './modules/users/users.entity';
import { FilesModule } from './modules/files/files.module';
import { AuthModule } from './modules/auth/auth.module';
import { MulterModule } from '@nestjs/platform-express';
import { TranslateJobGateway } from './gateways/forge/forge.gateway';
import { TranslateJobModule } from './modules/translate-job/translate-job.module';
import { BmmsMasterModule } from './modules/bms/bms.module';
import { Bmms_Master } from './modules/bms/bms.entity';
import { ApsModule } from './modules/aps/aps.module';

@Module({
    imports: [
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: 'giantcld.com',
            port: 5432,
            username: 'giantcld',
            password: '90637925',
            database: 'bmms',
            synchronize: true,
            logging: true,
            entities: [User, Bmms_Master],
            subscribers: [],
            migrations: [],
        }),
        MulterModule.register({
            dest: './uploads',
        }),
        AuthModule,
        FilesModule,
        TranslateJobModule,
        BmmsMasterModule,
        ApsModule,

],
    providers: [AppService, TranslateJobGateway],
})
export class AppModule { }
