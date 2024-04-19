import { BelongsTo, Column, ForeignKey, Table, Model, HasMany, DataType } from "sequelize-typescript";
import { User } from "src/user/entities/user.entity";

@Table({ tableName: 'author' })
export class Author extends Model<Author> {
  @Column({
    primaryKey: true,
    autoIncrement: true
  })
  id: number

  @Column({
    allowNull: false,
    comment: '作者id'
  })
  author_id: string

  @Column({
    allowNull: false,
    comment: '作者名称'
  })
  author_name: string

  @Column({
    allowNull: false,
    comment: '作者头像'
  })
  author_avatar: string

  @Column({
    allowNull: false,
    comment: '账号类型',
    defaultValue: 'publisher'
  })
  author_type: 'answer' | 'publisher'

  @Column({
    allowNull: false,
    comment: '是否为机构账号',
    defaultValue: false
  })
  is_org: boolean

  @Column({
    allowNull: true,
    comment: '最近一个问题id'
  })
  last_question_id: string

  @Column({
    allowNull: false,
    comment: '通知状态',
    defaultValue: false
  })
  notify_status: boolean

  @Column({
    allowNull: false,
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
