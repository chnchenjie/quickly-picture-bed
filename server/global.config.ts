export const email_config = {
  host: 'smtp.qq.com',
  port: '587',
  secure: false
}

// 问题的定时任务的cron表达式：每个一分钟执行
export const schedule_question_cron = 'second */1 * * * *'
// 发布者的定时任务的cron表达式：：每个一分钟执行
export const schedule_publisher_cron = 'second */1 * * * *'
// 答主的定时任务的cron表达式：每个一分钟执行
export const schedule_answer_cron = 'second */1 * * * *'