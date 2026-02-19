import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('Search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar entidad por systemCode' })
  @ApiQuery({
    name: 'code',
    required: true,
    description: 'SystemCode de la entidad (ej: TSK-260218-A3K7, ORG-260218-B2C3, PRJ-260218-D4F1)',
    example: 'TSK-260218-A3K7',
  })
  async findByCode(@Query('code') code: string) {
    return this.searchService.findByCode(code);
  }
}
