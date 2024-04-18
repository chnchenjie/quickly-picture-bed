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
    // 这里的逻辑改下，直接爬虫爬取
    const { author_id, is_org, last_question_id } = createAuthorDto
    const res = await axios({
      url: `https://www.zhihu.com/${is_org ? 'org' : 'people'}/${author_id}/asks`
    })
    const $ = cheerio.load(res.data)
    const initialDataEl = $('script#js-initialData')
    const initialDataJson = initialDataEl.text()
    const initialData = JSON.parse(initialDataJson)
    const user = initialData.initialState.entities.users[author_id]
    const data = await this.authorModel.create({
      author_id,
      is_org,
      last_question_id,
      author_name: user.name,
      author_avatar: user.avatarUrl,
      notify_status: false,
      status: false,
      uid
    })
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
    return this.authorModel.update({
      ...param
    }, {
      where: {
        id: param.id,
        uid
      }
    })
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
    var pass = 'hgnpyqcvxlwufdbg' // 邮箱授权码
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
    const { author_id, is_org, id } = author
    const job = new CronJob(time, async () => {
      this.logger.warn(`job ${author_id} execute one time!`)
      const lastAuthor = await this.findOne(id, uid)
      // 在这里编写查询是否变红包任务的逻辑
      try {
        const res = await axios({
          url: `https://www.zhihu.com/${is_org ? 'org' : 'people'}/${lastAuthor.author_id}/asks`
        })
        const $ = cheerio.load(res.data)
        const initialDataEl = $('script#js-initialData')
        const initialDataJson = initialDataEl.text()
        const initialData = JSON.parse(initialDataJson)
        const questions = initialData.initialState.entities.questions
        const ids = Object.keys(questions).filter(id => questions[id].questionType === 'commercial')
        const commercials = ids.map(id => questions[id]).sort((a, b) => b.created - a.created)
        if (commercials.length) {
          // 第一步：判断是否有新的问题
          const { id: question_id, title } = commercials[0]
          if (question_id.toString() !== lastAuthor.last_question_id.toString()) {
            // 第二步：发送邮件
            await this.sendMail(`【${lastAuthor.author_name}】新添加了一个问题：${title}，<a href="https://www.zhihu.com/question/${question_id}" target="_blank">赶快前往去回答吧</a>`, email)
            // 第三步：更新数据
            await this.authorModel.update({
              last_question_id: question_id
            }, {
              where: {
                id,
                uid
              }
            })
            // 第四步：不用关闭定时任务
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
   * @param task_id 
   */
  stopNotify (task_id: string) {
    const jobs = this.scheduleRegistry.getCronJobs()
    if (jobs.has(task_id)) {
      const job = this.scheduleRegistry.getCronJob(task_id)
      job && job.stop()
      this.logger.warn(`job ${task_id} stopped!`)
    }
  }

  /**
   * 删除通知
   * @param task_id 
   */
  deleteNotify (task_id: string) {
    const jobs = this.scheduleRegistry.getCronJobs()
    if (jobs.has(task_id)) {
      const job = this.scheduleRegistry.getCronJob(task_id)
      job && this.scheduleRegistry.deleteCronJob(task_id)
      this.logger.warn(`job ${task_id} deleted!`)
    }
  }

  /**
   * 关切换定时任务
   * @param ids 
   * @param uid 
   * @returns 
   */
  async toggleSchedule (id: number, uid) {
    const author = await this.findOne(id, uid)
    if (author.status) {
      this.stopNotify(author.author_id)
      this.deleteNotify(author.author_id)
    } else {
      this.startNotify(cron, author, uid)
    }
    return this.authorModel.update({
      status: !author.status
    }, {
      where: {
        id,
        uid
      }
    })
  }
}
