import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "../user/user.entity";

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

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    previousAt: Date;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' }) // 指定關聯欄位名稱
    uploader: User;
}