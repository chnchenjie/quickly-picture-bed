import { Module } from '@nestjs/common';
import { AuthorService } from './author.service';
import { AuthorController } from './author.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Author } from './entities/author.entity';
import { NotifyHistory } from './entities/notifyHistory';
import { ToolModule } from 'src/tool/tool.module';
import { Question } from 'src/question/entities/question.entity';

@Module({
  imports: [
    SequelizeModule.forFeature([Author, NotifyHistory, Question]),
    ToolModule
  ],
  controllers: [AuthorController],
  providers: [AuthorService],
})
export class AuthorModule {}
