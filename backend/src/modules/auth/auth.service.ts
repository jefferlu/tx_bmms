import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';
import { UsersService } from 'src/modules/users/users.service';

@Injectable()
export class AuthService {

    constructor(
        private jwtService: JwtService,
        private usersService: UsersService
    ) { }

    async signIn(email: string, password: string): Promise<any> {

        const user = await this.usersService.findOne(email);

        console.log(await bcrypt.compare(password, user.password))
        if (!await bcrypt.compare(password, user.password)) {
            throw new UnauthorizedException();
        }

        const payload = { sub: user.id, email: user.email };


        return {
            'access': await this.jwtService.signAsync(payload),
            'user': {
                'email': user.email,
                'name': user.username,
                'is_staff': true
            }
        }

    }
}

