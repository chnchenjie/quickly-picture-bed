import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserModule } from './user/user.module';
import { CommonModule } from './common/common.module';
import { ToolModule } from './tool/tool.module';
import { AuthModule } from './auth/auth.module';
import { PluginModule } from './plugin/plugin.module';
import { DictModule } from './dict/dict.module';
import { AlbumModule } from './album/album.module';
import { AlbumTagsModule } from './album-tags/album-tags.module';
import { SettingModule } from './setting/setting.module';
import { WikiModule } from './wiki/wiki.module';
import { ArticleModule } from './article/article.module';
import { BucketModule } from './bucket/bucket.module';
import { ImageModule } from './image/image.module';
import { LogModule } from './log/log.module';
import { StatsModule } from './stats/stats.module';
import { SmsCode } from './common/entities/smsCode.entity';
import { User } from './user/entities/user.entity';
import { QuestionModule } from './question/question.module';
import { AuthorModule } from './author/author.module';

console.log(process.env.NODE_ENV)
@Module({
  imports: [
    CommonModule,
    ConfigModule.forRoot({
      envFilePath: {
        development: ['.env.dev'],
        production: ['.env.dev']
      }[process.env.NODE_ENV || 'production'], // 自定义环境变量文件路径
      // 是否是全局模块
      isGlobal: true,
    }),
    // 环境变量的使用方式二并结合ConfigService使用
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        return {
          dialect: 'mariadb',// 数据库类型
          host: configService.get<string>('DB_HOST'),
          port: configService.get<number>('DB_PORT'),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_DATABASE'),
          // synchronize: true,// 是否自动同步数据库表结构
          autoLoadModels: true,// 是否自动加载模型
          retryDelay: 500,// 重试延迟
          retryAttempts: 10,// 重试次数
          // 连接池配置
          pool: {
            max: 5,// 最大连接数
            min: 0,// 最小连接数
            acquire: 30000,// 获取连接最大等待时间
            idle: 10000,// 闲置时间
          },
          // 数据库连接配置
          dialectOptions: {
            connectTimeout: 30000// 连接超时时间
          },
        }
      },
      inject: [ConfigService]
    }),
    UserModule,
    ToolModule,
    AuthModule,
    PluginModule,
    DictModule,
    AlbumModule,
    AlbumTagsModule,
    SettingModule,
    WikiModule,
    ArticleModule,
    BucketModule,
    ImageModule,
    LogModule,
    StatsModule,
    SequelizeModule.forFeature([SmsCode, User]),
    QuestionModule,
    AuthorModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
