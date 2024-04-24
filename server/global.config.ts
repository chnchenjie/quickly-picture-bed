export const email_config = {
  host: 'smtp.qq.com',
  port: '587',
  secure: false
}

// 问题的定时任务的cron表达式
export const schedule_question_cron = '00 * * * * *'
// 发布者的定时任务的cron表达式
export const schedule_publisher_cron = '30 * * * * *'
// 答主的定时任务的cron表达式
export const schedule_answer_cron = '55 * * * * *'