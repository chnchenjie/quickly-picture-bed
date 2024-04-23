import { ApiProperty } from "@nestjs/swagger"


export class CreateQuestionDto {
  @ApiProperty({ description: '问题id' })
  question_id: string

  @ApiProperty({ description: '作者id' })
  author_id: number

  @ApiProperty({ description: '问题来源' })
  type: 'publish' | 'answer' | 'follow'
}