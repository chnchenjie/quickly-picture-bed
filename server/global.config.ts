export const email_config = {
  user: '1825956830@qq.com',
  pass: 'hgnpyqcvxlwufdbg',
  host: 'smtp.qq.com',
  port: '587',
  secure: false
}

// 问题的定时任务的cron表达式
export const schedule_question_cron = '00 * * * * *'
// 发布者的定时任务的cron表达式
export const schedule_publisher_cron = '05 * * * * *'
// 答主的定时任务的cron表达式
export const schedule_answer_cron = '10 * * * * *'

// 通知邮箱
export const notify_emails = ['itchenliang@163.com', 'ischenliang@163.com']