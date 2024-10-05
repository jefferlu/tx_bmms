import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserDto } from './dtos/user.dto';

import * as bcrypt from 'bcrypt';

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

    async create(userDto: UserDto): Promise<any> {
        try {
            userDto.password = await this.hashPassword(userDto.password);
            return await this.userRepository.save(userDto);
        } catch (error) {
            // 假設使用 TypeORM，這裡檢查錯誤代碼          
            // if (error.code === '23505') { // PostgreSQL unique violation code
            //     return { error: true, code: error.code, message: 'Email already exists' };
            // }
            // 處理其他潛在錯誤
            // throw new InternalServerErrorException('An error occurred while creating the user');
            return { error: true, code: error.code, message: error.message };
        }
    }

    async update(id: number, userDto: Partial<UserDto>): Promise<any> {

        try {
            // 使用 findOneBy 查詢現有的用戶
            const user = await this.userRepository.findOneBy({ id });

            if (!user) {
                throw new NotFoundException('User not found');
            }

            if (userDto.password) {
                userDto.password = await this.hashPassword(userDto.password);
            }

            // 將 DTO 資料手動賦值給現有的 User 實體
            Object.assign(user, userDto);

            // 保存更新，這樣 @BeforeUpdate 就會被觸發
            return await this.userRepository.save(user);
        } catch (error) {
            return { error: true, code: error.code, message: error.message };
        }
    }

    async delete(id: number): Promise<void> {
        await this.userRepository.delete(id);
    }

    async findByEmail(email: string): Promise<User | undefined> {
        return this.userRepository.findOneBy({ email });
    }

    async hashPassword(password) {
        const salt = await bcrypt.genSalt(10);
        return await bcrypt.hash(password, salt);
    }
}
