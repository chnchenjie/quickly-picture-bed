import { Module } from '@nestjs/common';
import { AuthorService } from './author.service';
import { AuthorController } from './author.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Author } from './entities/author.entity';

@Module({
  imports: [
    SequelizeModule.forFeature([Author])
  ],
  controllers: [AuthorController],
  providers: [AuthorService],
})
export class AuthorModule {}
