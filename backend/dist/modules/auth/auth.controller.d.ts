import { AuthService } from './auth.service';
import { SignInDto } from './dtos/login.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    signIn(signInDto: SignInDto): Promise<any>;
    getProfile(req: any): any;
}
