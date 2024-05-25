import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Bmms_Master {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', unique: true })
    name: string;

    @Column({ type: 'varchar' })
    filePath: string;   

    @Column({ type: 'varchar' })
    svfPath: string;
}