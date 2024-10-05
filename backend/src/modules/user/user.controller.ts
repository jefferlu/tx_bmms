import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user.entity';
import { AuthGuard } from 'src/guards/auth/auth.guard';

@Controller('api/users')
export class UserController {

    constructor(private readonly userService: UserService) { }

    @UseGuards(AuthGuard)
    @Get()
    findAll() {
        return this.userService.findAll();
    }

    @UseGuards(AuthGuard)
    @Get(':id')
    findOne(@Param('id') id: number) {
        return this.userService.findOne(id);
    }

    @UseGuards(AuthGuard)
    @Post()
    create(@Body() user: User) {
        return this.userService.create(user);
    }

    @UseGuards(AuthGuard)
    @Put(':id')
    update(@Param('id') id: number, @Body() user: Partial<User>) {
        return this.userService.update(id, user);
    }

    @UseGuards(AuthGuard)
    @Delete(':id')
    delete(@Param('id') id: number) {
        return this.userService.delete(id);
    }

}
