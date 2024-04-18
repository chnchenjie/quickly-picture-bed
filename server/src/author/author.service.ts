import { Injectable, Logger } from '@nestjs/common';
import { AuthorFilter, CreateAuthorDto } from './dto/create-author.dto';
import { UpdateAuthorDto } from './dto/update-author.dto';
import { InjectModel } from '@nestjs/sequelize';
import { Author } from './entities/author.entity';
import { SchedulerRegistry } from '@nestjs/schedule';
import axios from 'axios';
import * as cheerio from 'cheerio'
import { CronJob } from 'cron';
import * as nodemailer from 'nodemailer'
import { Op } from 'sequelize';
const cron = '10 * * * * *'
const email = 'itchenliang@163.com'

@Injectable()
export class AuthorService {
  private readonly logger = new Logger(AuthorService.name)
  constructor (
    @InjectModel(Author) private authorModel: typeof Author,
    private scheduleRegistry: SchedulerRegistry
  ) {}

  /**
   * 创建
   * @param createAuthorDto 
   * @param uid 
   * @returns 
   */
  async create(createAuthorDto: CreateAuthorDto, uid: number) {
    const data = await this.authorModel.create({
      ...createAuthorDto,
      notify_status: false,
      status: true,
      uid
    })
    this.startNotify(cron, data, uid)
    return data
  }

  /**
   * 查询列表
   * @param param 
   * @param uid 
   * @returns 
   */
  async findAll(param: AuthorFilter, uid: number) {
    const { page, size, search, status } = param
    const data: any = {}
    const tmp: any = {
      order: [
        ['createdAt', 'desc']
      ],
      where: {
        uid: uid,
        author_id: {
          [Op.like]: search ? `%${search}%` : '%%'
        },
        author_name: {
          [Op.like]: search ? `%${search}%` : '%%'
        },
        author_avatar: {
          [Op.like]: search ? `%${search}%` : '%%'
        },
        last_question_id: {
          [Op.like]: search ? `%${search}%` : '%%'
        }
      }
    }
    if (Object.keys(param).includes('status')) {
      tmp.where.status = status
    }
    if (page) {
      tmp.limit = size || 10
      tmp.offset = page ? (page - 1) * size : 0
    }
    const { count, rows } = await this.authorModel.findAndCountAll(tmp)
    data.total = count
    data.items = rows
    return data;
  }

  /**
   * 详情
   * @param id 
   * @param uid 
   * @returns 
   */
  findOne(id: number, uid: number) {
    return this.authorModel.findOne({
      where: {
        id,
        uid
      }
    })
  }

  /**
   * 更新
   * @param id 
   * @param uid 
   * @returns 
   */
  async update(param: CreateAuthorDto, uid: number) {
    const data = await this.authorModel.update({
      ...param
    }, {
      where: {
        id: param.id,
        uid
      }
    })
    const res = await this.findOne(param.id, uid)
    this.stopNotify(res.author_id)
    this.deleteNotify(res.author_id)
    this.startNotify(cron, res, uid)
    return data
  }

  /**
   * 删除问题
   * @param id 
   * @param uid 
   * @returns 
   */
  async remove(id: number, uid: number) {
    const data = await this.authorModel.findOne({
      where: {
        id,
        uid
      }
    })
    if (data) {
      this.stopNotify(data.author_id)
      this.deleteNotify(data.author_id)
    }
    return this.authorModel.destroy({
      where: {
        id,
        uid
      }
    });
  }

  
  /**
   * 发送邮件
   * @param text 验证码
   * @param to 收件人邮箱
   * @param subject 标题
   * @returns 
   */
  sendMail (text: string, to: string, subject: string = 'LightFastPicture') {
    var user = '1825956830@qq.com' // 自己的邮箱
    var pass = 'stjflvegjjumbbfa' // 邮箱授权码
    let transporter = nodemailer.createTransport({
      host: "smtp.qq.com",
      port: 587,
      secure: false,
      //配置发送者的邮箱服务器和登录信息
      // service:'qq', // 163、qq等
      auth: {
        user: user, // 用户账号
        pass: pass, //授权码,通过QQ获取
      },
    })
    return new Promise((resolve, reject) => {
      if (pass && user) {
        transporter.sendMail({
          from: `<${user}>`,
          to: `<${to}>`,
          subject: subject,
          html: `${text}`,
        }).then(() => {
          resolve(true)
        }).catch(error => {
          reject(error)
        })
      } else {
        reject(new Error('未配置邮件服务'))
      }
    })
  }

  /**
   * 开始通知：创建定时任务
   * @param time 
   * @param question_id 
   */
  startNotify (time: string, author: CreateAuthorDto, uid: number) {
    const { author_id, last_question_id, is_org, author_name, id } = author
    const job = new CronJob(time, async () => {
      // 在这里编写查询是否变红包任务的逻辑
      try {
        const res = await axios({
          url: `https://www.zhihu.com/${is_org ? 'org' : 'people'}/${author_id}/asks`
        })
        const $ = cheerio.load(res.data)
        const initialDataEl = $('script#js-initialData')
        const initialDataJson = initialDataEl.text()
        const initialData = JSON.parse(initialDataJson)
        const questions = initialData.initialState.entities.questions
        const ids = Object.keys(questions).filter(id => questions[id].questionType === 'commercial')
        const commercials = ids.map(id => questions[id]).sort((a, b) => b.created - a.created)
        if (commercials.length) {
          // 有新的问题
          const { id: question_id, title } = commercials[0]
          if (question_id !== last_question_id) {
            await this.sendMail(`【${author_name}】新添加了一个问题：${title}，<a href="https://www.zhihu.com/question/${question_id}" target="_blank">赶快前往去回答吧</a>`, email)
            await this.authorModel.update({
              last_question_id: question_id
            }, {
              where: {
                id,
                uid
              }
            })
          }
        }
      } catch (error) {
        // 没有新增问题：继续定时任务
        console.log(error)
      }
    })

    this.scheduleRegistry.addCronJob(author_id, job)
    job.start()
    this.logger.warn(`job ${author_id} added!`)
  }


  /**
   * 暂停通知
   * @param question_id 
   */
  stopNotify (question_id: string) {
    const job = this.scheduleRegistry.getCronJob(question_id)
    job && job.stop()
    this.logger.warn(`job ${question_id} stopped!`)
  }

  /**
   * 删除通知
   * @param question_id 
   */
  deleteNotify (question_id: string) {
    this.scheduleRegistry.deleteCronJob(question_id)
    this.logger.warn(`job ${question_id} deleted!`)
  }
}
