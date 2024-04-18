import { Injectable, Logger } from '@nestjs/common';
import { CreateQuestionDto, QuestionFilter } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { InjectModel } from '@nestjs/sequelize';
import { Question } from './entities/question.entity';
import axios from 'axios';
import * as cheerio from 'cheerio'
import { Op } from 'sequelize';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import * as nodemailer from 'nodemailer'
const cron = '10 * * * * *'

@Injectable()
export class QuestionService {
  private readonly logger = new Logger(QuestionService.name)
  constructor (
    @InjectModel(Question) private questionModel: typeof Question,
    private scheduleRegistry: SchedulerRegistry
  ) {}

  /**
   * 创建问题
   * @param createQuestionDto 
   * @param uid 
   * @returns 
   */
  async create(createQuestionDto: CreateQuestionDto, uid: number) {
    try {
      // 自动获取问题内容
      const res = await axios({
        url: `https://www.zhihu.com/question/${createQuestionDto.quesion_id}`,
        method: 'get'
      })
      const $ = cheerio.load(res.data)
      const initialDataEl = $('script#js-initialData')
      const initialDataJson = initialDataEl.text()
      const initialData = JSON.parse(initialDataJson)
      const { title, excerpt, author, created, updatedTime } = initialData.initialState.entities.questions[createQuestionDto.quesion_id]
      const question = await this.questionModel.create({
        quesion_id: createQuestionDto.quesion_id,
        question_title: title,
        question_desc: excerpt || '',
        question_author_id: author.urlToken || author.id,
        question_author_name: author.name || '',
        question_author_avatar: author.avatarUrl || author.avatarUrlTemplate,
        question_created: created,
        question_updated: updatedTime,
        uid: uid
      })
      // 创建完任务后立马启用通知
      this.startNotify(cron, createQuestionDto.quesion_id, uid)
      return question
    } catch (error) {
      return {
        statusCode: 500,
        data: error
      }
    }
  }

  /**
   * 查询列表
   * @param param 
   * @param uid 
   * @returns 
   */
  async findAll(param: QuestionFilter, uid: number) {
    const { page, size, search, status } = param
    const data: any = {}
    const tmp: any = {
      order: [
        ['question_updated', 'desc']
      ],
      where: {
        uid: uid,
        question_title: {
          [Op.like]: search ? `%${search}%` : '%%'
        },
        question_desc: {
          [Op.like]: search ? `%${search}%` : '%%'
        },
        question_author_name: {
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
    const { count, rows } = await this.questionModel.findAndCountAll(tmp)
    data.total = count
    data.items = rows
    return data;
  }

  /**
   * 问题详情
   * @param id 
   * @param uid 
   * @returns 
   */
  findOne(id: number, uid: number) {
    return this.questionModel.findOne({
      where: {
        id,
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
    const data = await this.questionModel.findOne({
      where: {
        id,
        uid
      }
    })
    if (data) {
      this.stopNotify(data.quesion_id)
      this.deleteNotify(data.quesion_id)
    }
    return this.questionModel.destroy({
      where: {
        id,
        uid
      }
    });
  }

  /**
   * 更新数据
   * @param updateDto 
   * @param quesion_id 
   * @param uid 
   */
  update (updateDto: UpdateQuestionDto, quesion_id: string, uid: number) {
    return this.questionModel.update({
      ...updateDto
    }, {
      where: {
        quesion_id: quesion_id,
        uid
      }
    })
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
  startNotify (time: string, question_id: string, uid: number) {
    const job = new CronJob(time, async () => {
      // 在这里编写查询是否变红包任务的逻辑
      try {
        const res = await axios({
          url: `https://www.zhihu.com/api/v4/brand/questions/${question_id}/activity/red-packet`
        })
        const { content, title, count_down_value } = res.data
        if (count_down_value) {
          // 第一步：邮箱通知
          await this.sendMail(content, 'itchenliang@163.com')
          // 第二步：更新状态
          let money = 0
          const match = title.match(/\d+/)
          if (match) {
            money = parseInt(match[0])
            await this.update({
              question_red_money: money,
              question_red_count: count_down_value,
              notify_status: true
            }, question_id, uid)
          }
          // 第三步：关闭并删除定时任务
          this.stopNotify(question_id)
          this.deleteNotify(question_id)
        }
      } catch (error) {
        // 不是红包问题：继续定时任务
        console.log(error)
      }
    })
    this.scheduleRegistry.addCronJob(question_id, job)
    job.start()
    this.logger.warn(`job ${question_id} added!`)
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

  /**
   * 开启定时任务
   * @param ids 
   * @param uid 
   * @returns 
   */
  async startSchedule (ids: number[], uid) {
    const promises = ids.map(id => this.findOne(id, uid))
    const quesions = await Promise.all(promises)
    const questionPromises = quesions.filter(quesion => quesion && quesion.id && !quesion.notify_status).map(quesion => {
      this.startNotify(cron, quesion.quesion_id, uid)
      return this.update({ status: true }, quesion.quesion_id, uid)
    })
    return Promise.all(questionPromises)
  }

  /**
   * 关闭定时任务
   * @param ids 
   * @param uid 
   * @returns 
   */
  async stopSchedule (ids: number[], uid) {
    const promises = ids.map(id => this.findOne(id, uid))
    const quesions = await Promise.all(promises)
    const questionPromises = quesions.filter(quesion => quesion && quesion.id && !quesion.notify_status).map(quesion => {
      this.stopNotify(quesion.quesion_id)
      this.deleteNotify(quesion.quesion_id)
      return this.update({ status: false }, quesion.quesion_id, uid)
    })
    return Promise.all(questionPromises)
  }
}