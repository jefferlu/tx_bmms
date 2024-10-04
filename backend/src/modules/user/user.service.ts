import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserService {

    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) { }

    async findAll(): Promise<User[]> {
        let users = this.userRepository.find({
            select: ['id', 'email', 'username', 'firstName', 'lastName', 'is_supreuser', 'is_staff', 'is_active']
        });
        console.log(users)
        return users;
    }

    async findOne(id: number): Promise<User> {
        return this.userRepository.findOneBy({ id });
    }

    async create(user: User): Promise<User> {
        return this.userRepository.save(user);
    }

    async update(id: number, user: Partial<User>): Promise<any> {
        return await this.userRepository.update(id, user);                
    }

    async delete(id: number): Promise<void> {
        await this.userRepository.delete(id);
    }

    async findByEmail(email: string): Promise<User | undefined> {
        return this.userRepository.findOneBy({ email });
    }
}
