import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/modules/users/users.service';
export declare class AuthService {
    private jwtService;
    private usersService;
    constructor(jwtService: JwtService, usersService: UsersService);
    signIn(email: string, password: string): Promise<any>;
}
