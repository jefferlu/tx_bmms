import { Repository } from 'typeorm';
import { User } from './users.entity';
export declare class UsersService {
    private usersRepository;
    constructor(usersRepository: Repository<User>);
    checkExist(data: Partial<User>): Promise<boolean>;
    createUser(data: Partial<User>): Promise<User>;
    updateUser(data: Partial<User>): Promise<User>;
    findOne(email: string): Promise<User | undefined>;
}
