import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {

    constructor(
        @InjectRepository(User)
        private usersRepository: Repository<User>,
    ) {
        // let data = { 'email': 'demo@company.com', 'password': 'demo' }
        // if (this.checkExist(data)) {
        //     this.updateUser(data);
        // }
        // else {
        //     this.createUser(data);
        // }
        // this.usersRepository.save({ 'email': 'demo@company.com', 'password': 'demo' })
    }

    async checkExist(data: Partial<User>): Promise<boolean> {

        // check user exist
        const { email } = data;
        let exist = await this.findOne(email);
        return exist ? true : false;
        // throw new ConflictException('Email already exists');
    }

    async createUser(data: Partial<User>): Promise<User> {

        const { email, password } = data;
        const saltOrRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltOrRounds);

        let user = this.usersRepository.create({
            ...data,
            password: hashedPassword,
        })

        return this.usersRepository.save(user);;
    }

    async updateUser(data: Partial<User>): Promise<User> {
        console.log('update')
        const { email, password } = data;
        const saltOrRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltOrRounds);

        let user = await this.findOne(email);
        user.password = hashedPassword;
        delete data.password;

        Object.assign(user, data);

        console.log(user)
        return this.usersRepository.save(user);
    }

    async findOne(email: string): Promise<User | undefined> {
        return this.usersRepository.findOneBy({ email });
    }


}
