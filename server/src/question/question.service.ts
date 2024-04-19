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
import { ToolService } from 'src/tool/tool.service';
import { notify_emails, schedule_question_cron } from 'global.config';

@Injectable()
export class QuestionService {
  private readonly logger = new Logger(QuestionService.name)
  constructor (
    @InjectModel(Question) private questionModel: typeof Question,
    private scheduleRegistry: SchedulerRegistry,
    private readonly toolService: ToolService,
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
        status: false,
        uid: uid
      })
      // 创建完任务后立马启用通知
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
    console.log(search)
    const data: any = {}
    const tmp: any = {
      order: [
        ['createdAt', 'desc']
      ],
      where: {
        uid: uid,
        [Op.or]: {
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
      this.stopNotify(data.quesion_id + '-' + data.id)
      this.deleteNotify(data.quesion_id + '-' + data.id)
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
  update (updateDto: UpdateQuestionDto, id: number, uid: number) {
    return this.questionModel.update({
      ...updateDto
    }, {
      where: {
        id,
        uid
      }
    })
  }

  /**
   * 开始通知：创建定时任务
   * @param time 
   * @param obj 
   * @param uid 
   */
  startNotify (time: string, obj: { id: number; question_id: string }, uid: number) {
    const { id, question_id  } = obj
    const job = new CronJob(time, async () => {
      // 在这里编写查询是否变红包任务的逻辑
      const last_question = await this.questionModel.findOne({
        where: {
          id
        }
      })
      try {
        const res = await axios({
          url: `https://www.zhihu.com/api/v4/brand/questions/${question_id}/activity/red-packet`
        })
        const { content, title, count_down_value } = res.data
        if (count_down_value) {
          // 第一步：邮箱通知
          await Promise.all(notify_emails.map((email) => {
            return this.toolService.sendZhihuMail(`【${last_question.question_title}】问题变红包了，<a href="https://www.zhihu.com/question/${question_id}" target="_blank">赶快去回答吧</a>！${content}`, email)
          }))
          // 第二步：更新状态
          let money = 0
          const match = title.match(/\d+/)
          if (match) {
            money = parseInt(match[0])
            await this.update({
              question_red_money: money,
              question_red_count: count_down_value,
              notify_status: true,
              status: false
            }, id, uid)
            // 第三步：关闭并删除定时任务
            this.stopNotify(question_id + '-' + id)
            this.deleteNotify(question_id + '-' + id)
          }
        }
      } catch (error) {
        // 不是红包问题：继续定时任务
        console.log(error)
      }
    })
    this.scheduleRegistry.addCronJob(question_id + '-' + id, job)
    job.start()
    this.logger.warn(`job ${question_id + '-' + id} added!`)
  }

  /**
   * 暂停通知
   * @param question_id 
   */
  stopNotify (question_id: string) {
    const jobs = this.scheduleRegistry.getCronJobs()
    if (jobs.has(question_id)) {
      const job = this.scheduleRegistry.getCronJob(question_id)
      job && job.stop()
      this.logger.warn(`job ${question_id} stopped!`)
    }
  }

  /**
   * 删除通知
   * @param question_id 
   */
  deleteNotify (question_id: string) {
    const jobs = this.scheduleRegistry.getCronJobs()
    if (jobs.has(question_id)) {
      const job = this.scheduleRegistry.getCronJob(question_id)
      job && this.scheduleRegistry.deleteCronJob(question_id)
      this.logger.warn(`job ${question_id} deleted!`)
    }
  }

  /**
   * 关闭定时任务
   * @param ids 
   * @param uid 
   * @returns 
   */
  async toggleSchedule (id: number, uid) {
    const quesion = await this.findOne(id, uid)
    if (quesion.status) {
      this.stopNotify(quesion.quesion_id + '-' + quesion.id)
      this.deleteNotify(quesion.quesion_id + '-' + quesion.id)
    } else {
      this.startNotify(schedule_question_cron, {
        id: id,
        question_id: quesion.quesion_id
      }, uid)
    }
    return this.questionModel.update({
      status: !quesion.status
    }, {
      where: {
        id,
        uid
      }
    })
  }
}