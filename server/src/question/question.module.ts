import { Module } from '@nestjs/common';
import { QuestionService } from './question.service';
import { QuestionController } from './question.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Question } from './entities/question.entity';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    SequelizeModule.forFeature([Question]),
    ScheduleModule.forRoot()
  ],
  controllers: [QuestionController],
  providers: [QuestionService],
  exports: [QuestionService]
})
export class QuestionModule {}
