import { Injectable, Logger } from '@nestjs/common';
import { AuthorFilter, CreateAuthorDto } from './dto/create-author.dto';
import { InjectModel } from '@nestjs/sequelize';
import { Author } from './entities/author.entity';
import { SchedulerRegistry } from '@nestjs/schedule';
import axios from 'axios';
import * as cheerio from 'cheerio'
import { CronJob } from 'cron';
import { Op } from 'sequelize';
import { NotifyHistory } from './entities/notifyHistory';
import { ToolService } from 'src/tool/tool.service';
import { notify_emails, schedule_answer_cron, schedule_publisher_cron } from 'global.config';
import { Question } from 'src/question/entities/question.entity';

/**
 * 查询回答中疑似红包的问题
 * @param {*} answers 
 * @returns 
 */
function getAnswerRedPack (answers, author_id) {
  // 查询疑似问题的回答并且是当前该作者的回答，因为点赞的回答也会包含在这里面
  const ids = Object.keys(answers).filter(id => {
    return answers[id].question.questionType === 'commercial' && answers[id].author.urlToken === author_id
  })
  const commercials = ids.map(id => {
    const item = answers[id]
    return {
      id: item.question.id,
      title: item.question.title,
      created: item.question.created
    }
  }).sort((a, b) => b.created - a.created)
  return commercials
}


/**
 * 查询关注中疑似红包的问题
 * @param {*} answers 
 * @returns 
 */
function getQuestionRedPack (questions) {
  const ids = Object.keys(questions).filter(id => questions[id].questionType === 'commercial')
  const commercials = ids.map(id => {
    const item = questions[id]
    return {
      id: item.id,
      title: item.title,
      created: item.created
    }
  })
  // 不需要排序，因为返回的数据其实都是按照出现的顺序排序的
  // .sort((a, b) => b.created - a.created)
  return commercials
}

@Injectable()
export class AuthorService {
  private readonly logger = new Logger(AuthorService.name)
  constructor (
    @InjectModel(Author) private authorModel: typeof Author,
    @InjectModel(NotifyHistory) private notifyHistoryModel: typeof NotifyHistory,
    @InjectModel(Question) private questionModel: typeof Question,
    private scheduleRegistry: SchedulerRegistry,
    private readonly toolService: ToolService,
  ) {}

  /**
   * 创建
   * @param createAuthorDto 
   * @param uid 
   * @returns 
   */
  async create(createAuthorDto: CreateAuthorDto, uid: number) {
    // 这里的逻辑改下，直接爬虫爬取
    const { author_id, is_org, last_question_id, author_type } = createAuthorDto
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
      author_type: author_type,
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
    const { page, size, search, author_type } = param
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
    if (Object.keys(param).includes('author_type')) {
      tmp.where.author_type = author_type
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
            await Promise.all(notify_emails.map((email) => {
              return this.toolService.sendZhihuMail(`【${lastAuthor.author_name}】新添加了一个问题：${title}，<a href="https://www.zhihu.com/question/${question_id}" target="_blank">赶快前往去回答吧</a>`, email)
            }))
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
   * 开始通知：创建定时任务
   * @param time 
   * @param question_id 
   */
  startAnswerNotify (time: string, author: CreateAuthorDto, uid: number) {
    const { author_id, is_org, id } = author
    const job = new CronJob(time, async () => {
      this.logger.warn(`job ${author_id} execute one time!`)
      const lastAuthor = await this.findOne(id, uid)
      try {
        // 1、爬虫爬取该作者的动态数据
        const res = await axios({
          url: `https://www.zhihu.com/${is_org ? 'org' : 'people'}/${lastAuthor.author_id}`
        })
        const $ = cheerio.load(res.data)
        const initialDataEl = $('script#js-initialData')
        const initialDataJson = initialDataEl.text()
        const initialData = JSON.parse(initialDataJson)
        // 2、解析数据
        // 2.1、该作者关注的问题
        const questions = initialData.initialState.entities.questions
        // 查询该作者关注的问题中疑似红包的问题
        const question_commercials = getQuestionRedPack(questions)
        // 2.2、该作者回答的问题
        const answers = initialData.initialState.entities.answers
        // 查询该作者回答的疑似红包的问题
        const answer_commercials = getAnswerRedPack(answers, lastAuthor.author_id)
        // 3、判断当前问题是否已经关注过或者已通知过
        if (question_commercials.length) {
          let flag = false // 标记是否是最新的问题
          // 3.1、判断关注的最新一个问题是否在标记的最新问题
          const last_question = question_commercials[0]
          // 3.2、从通知中判断当前问题是否已经通知过
          const notify_history = await this.notifyHistoryModel.findOne({
            where: {
              author_id: lastAuthor.author_id,
              question_id: last_question.id.toString(),
              uid
            }
          })
          if (notify_history) {
            if (notify_history.question_id.toString() === last_question.id.toString()) {
              flag = true
            } else {
              if (last_question.id.toString() === lastAuthor.last_question_id.toString()) {
                flag = true
              }
            }
          }
          if (!flag) {
            // 发送邮件
            await Promise.all(notify_emails.map((email) => {
              return this.toolService.sendZhihuMail(`【${lastAuthor.author_name}】新关注了一个问题：${last_question.title}，<a href="https://www.zhihu.com/question/${last_question.id}" target="_blank">赶快前往去回答吧</a>`, email)
            }))
            // 更新数据
            await this.authorModel.update({
              last_question_id: last_question.id
            }, {
              where: {
                id,
                uid
              }
            })
            await this.notifyHistoryModel.create({
              question_id: last_question.id,
              author_id: lastAuthor.author_id,
              uid
            })
          }
        }
        // 4、判断当前问题是否已经回答过或者已通过过
        if (answer_commercials.length) {
          let flag = false // 标记是否是最新的问题
          // 4.1、判断关注的最新一个问题是否在标记的最新问题
          const last_question = answer_commercials[0]
          // 4.2、从通知中判断当前问题是否已经通知过
          const notify_history = await this.notifyHistoryModel.findOne({
            where: {
              author_id: lastAuthor.author_id,
              question_id: last_question.id,
              uid
            }
          })
          if (notify_history) {
            if (notify_history.question_id.toString() === last_question.id.toString()) {
              flag = true
            } else {
              if (last_question.id.toString() === lastAuthor.last_question_id.toString()) {
                flag = true
              }
            }
          }
          if (!flag) {
            // 发送邮件
            await Promise.all(notify_emails.map(async (email) => {
              return this.toolService.sendZhihuMail(`【${lastAuthor.author_name}】新回答了一个问题：${last_question.title}，<a href="https://www.zhihu.com/question/${last_question.id}" target="_blank">赶快前往去回答吧</a>`, email)
            }))
            // 更新数据
            await this.authorModel.update({
              last_question_id: last_question.id
            }, {
              where: {
                id,
                uid
              }
            })
            await this.notifyHistoryModel.create({
              question_id: last_question.id,
              author_id: lastAuthor.author_id,
              uid
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
      if (author.author_type === 'answer') {
        this.startAnswerNotify(schedule_answer_cron, author, uid)
      } else {
        this.startNotify(schedule_publisher_cron, author, uid)
      }
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

  async getStats (uid: number) {
    const question = {
      total: await this.questionModel.count({
        where: {
          uid
        }
      }),
      schedule: await this.questionModel.count({
        where: {
          uid,
          status: true
        }
      })
    }
    const answer = {
      total: await this.authorModel.count({
        where: {
          uid,
          author_type: 'answer'
        }
      }),
      schedule: await this.authorModel.count({
        where: {
          uid,
          author_type: 'answer',
          status: true
        }
      })
    }
    const publisher = {
      total: await this.authorModel.count({
        where: {
          uid,
          author_type: 'publisher'
        }
      }),
      schedule: await this.authorModel.count({
        where: {
          uid,
          author_type: 'publisher',
          status: true
        }
      })
    }
    return {
      question,
      answer,
      publisher
    }
  }
}
