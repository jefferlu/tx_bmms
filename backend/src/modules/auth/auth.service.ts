import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';

@Injectable()
export class AuthService {

    constructor(
        private jwtService: JwtService,
        private userService: UserService
    ) { }

    async signIn(email: string, password: string): Promise<any> {

        const user = await this.userService.findByEmail(email);

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

