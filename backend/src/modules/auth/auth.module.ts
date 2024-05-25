import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { jwtConstants } from './constants';
import { UsersModule } from 'src/modules/users/users.module';

@Module({
    imports: [
        JwtModule.register({
            global: true,
            secret: jwtConstants.secret,
            signOptions: { expiresIn: '7d' },
        }),
        UsersModule,
    ],
    controllers: [AuthController],
    providers: [AuthService]
})
export class AuthModule { }
