import { BelongsTo, Column, ForeignKey, Table, Model } from "sequelize-typescript";
import { User } from "src/user/entities/user.entity";
import { Author } from "./author.entity";

@Table({ tableName: 'author_question' })
export class AuthorQuestion extends Model<AuthorQuestion> {
  @Column({
    primaryKey: true,
    autoIncrement: true
  })
  id: number

  @Column({
    allowNull: false,
    comment: '问题id'
  })
  question_id: string

  @Column({
    allowNull: false,
    comment: '问题标题'
  })
  question_title: string

  @Column({
    allowNull: false,
    comment: '问题描述'
  })
  question_desc: string

  @Column({
    allowNull: false,
    comment: '问题类型(commercial-疑似红包问题  normal-普通问题)'
  })
  question_type: string

  @Column({
    allowNull: false,
    comment: '类型(publish-发布 answer-回答  follow-关注)'
  })
  type: string

  @Column({
    allowNull: false,
    comment: '问题创建时间'
  })
  question_created: string

  @Column({
    allowNull: false,
    comment: '问题更新时间'
  })
  question_updated: string


  @ForeignKey(() => User)
  @Column({
    comment: '创建人'
  })
  uid: number

  @ForeignKey(() => Author)
  @Column({
    comment: '作者'
  })
  aid: number

  @BelongsTo(() => User, 'uid')
  user: User

  @BelongsTo(() => Author, 'aid')
  author: Author
}
