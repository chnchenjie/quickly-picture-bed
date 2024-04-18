import { BelongsTo, Column, ForeignKey, Table, Model, HasMany, DataType } from "sequelize-typescript";
import { User } from "src/user/entities/user.entity";

@Table({ tableName: 'question' })
export class Question extends Model<Question> {
  @Column({
    primaryKey: true,
    autoIncrement: true
  })
  id: number

  @Column({
    allowNull: false,
    comment: '问题原id'
  })
  quesion_id: string

  @Column({
    allowNull: false,
    comment: '问题标题'
  })
  question_title: string

  @Column({
    allowNull: true,
    comment: '问题描述'
  })
  question_desc: string

  @Column({
    allowNull: false,
    comment: '问题作者名称'
  })
  question_author_name: string

  @Column({
    allowNull: false,
    comment: '问题作者id'
  })
  question_author_id: string

  @Column({
    allowNull: false,
    comment: '问题作者头像'
  })
  question_author_avatar: string

  @Column({
    allowNull: false,
    comment: '问题创建时间'
  })
  question_created: string

  @Column({
    allowNull: true,
    comment: '问题更新时间'
  })
  question_updated: string

  @Column({
    allowNull: true,
    comment: '问题红包金额',
    defaultValue: 0
  })
  question_red_money: number

  @Column({
    allowNull: true,
    comment: '问题红包个数',
    defaultValue: 0
  })
  question_red_count: number

  @Column({
    allowNull: true,
    comment: '通知状态',
    defaultValue: false
  })
  notify_status: boolean

  @Column({
    allowNull: true,
    comment: '状态',
    defaultValue: true
  })
  status: boolean

  @ForeignKey(() => User)
  @Column({
    comment: '创建人'
  })
  uid: number

  @BelongsTo(() => User, 'uid')
  user: User
}
