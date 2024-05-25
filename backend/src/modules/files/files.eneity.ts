import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class File {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    originalName: string;

    @Column({ nullable: true })
    fileName: string;

    @Column({ nullable: true })
    mimeType: string;

    @Column({ nullable: true })
    size: number;
}
