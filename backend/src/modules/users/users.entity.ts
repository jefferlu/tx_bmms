import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @ApiProperty()
    @Column({ type: 'varchar', unique: true })
    email: string;

    @ApiProperty()
    @Column({ type: 'varchar' })
    password: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    username: string;

    @Column({ type: 'varchar', nullable: true })
    firstName: string;

    @Column({ type: 'varchar', nullable: true })
    lastName: string;

    @Column({ type: 'boolean', default: false })
    is_supreuser: boolean;

    @Column({ type: 'boolean', default: true })
    is_staff: boolean;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

}