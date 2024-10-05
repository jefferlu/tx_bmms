import { IsBoolean, IsEmail, IsOptional, IsString } from "class-validator";

export class UserDto {
    @IsEmail()
    email: string;

    @IsString()
    // @MinLength(6)
    password: string;

    @IsString()
    @IsOptional()
    username?: string;

    @IsString()
    @IsOptional()
    firstName?: string;

    @IsString()
    @IsOptional()
    lastName?: string;

    @IsBoolean()
    @IsOptional()
    is_supreuser?: boolean;

    @IsBoolean()
    @IsOptional()
    is_staff?: boolean;

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;
}