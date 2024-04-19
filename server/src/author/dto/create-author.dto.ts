import { ApiProperty } from "@nestjs/swagger";
import { PageSearch } from "src/common/dto/pageSearch.entity";

export class CreateAuthorDto {
  @ApiProperty({ description: 'id' })
  id?: number

  @ApiProperty({ description: '作者id' })
  author_id: string

  @ApiProperty({ description: '账号类型' })
  author_type: 'answer' | 'publisher'

  @ApiProperty({ description: '是否为机构账号' })
  is_org: boolean

  @ApiProperty({ description: '最新问题id' })
  last_question_id: string
}

export class AuthorFilter extends PageSearch {
  @ApiProperty({ description: '账号类型' })
  author_type: 'answer' | 'publisher'
}