import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TaskAiUsageStatus } from '../entities/task-ai-usage-execution.entity';

const MAX_SAFE_TOKEN_COUNT = Number.MAX_SAFE_INTEGER;

export class RecordTaskAiUsageDto {
  @ApiProperty({
    enum: TaskAiUsageStatus,
    example: TaskAiUsageStatus.RECORDED,
    description: 'How complete and applicable this execution usage report is',
  })
  @IsEnum(TaskAiUsageStatus)
  status: TaskAiUsageStatus;

  @ApiPropertyOptional({ example: 'openai' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  provider?: string;

  @ApiPropertyOptional({ example: 'gpt-4.1' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  @ApiPropertyOptional({ example: 'taskhub-mcp' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @ApiPropertyOptional({ example: 'provider-run-123' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  executionId?: string;

  @ApiPropertyOptional({ example: 1200, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_TOKEN_COUNT)
  inputTokens?: number;

  @ApiPropertyOptional({ example: 800, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_TOKEN_COUNT)
  outputTokens?: number;

  @ApiPropertyOptional({ example: 2000, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_TOKEN_COUNT)
  totalTokens?: number;

  @ApiPropertyOptional({ example: 'usage_unavailable' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reasonCode?: string;

  @ApiPropertyOptional({ example: 'The provider did not expose token usage.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
