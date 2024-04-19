import { BelongsTo, Column, ForeignKey, Table, Model, HasMany, DataType } from "sequelize-typescript";
import { User } from "src/user/entities/user.entity";

@Table({ tableName: 'notify_history' })
export class NotifyHistory extends Model<NotifyHistory> {
  @Column({
    primaryKey: true,
    autoIncrement: true
  })
  id: number

  @Column({
    allowNull: false,
    comment: '通知的问题id'
  })
  question_id: string

  @Column({
    allowNull: false,
    comment: '由哪个答主的账号通知的'
  })
  author_id: string

  @ForeignKey(() => User)
  @Column({
    comment: '创建人'
  })
  uid: number

  @BelongsTo(() => User, 'uid')
  user: User
}
