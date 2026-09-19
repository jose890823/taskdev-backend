import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RecordTaskAiUsageDto } from './dto/record-task-ai-usage.dto';
import {
  TaskAiUsageExecution,
  TaskAiUsageStatus,
} from './entities/task-ai-usage-execution.entity';

const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const DEFAULT_REASON: Record<
  Exclude<TaskAiUsageStatus, TaskAiUsageStatus.RECORDED>,
  { code: string; message: string }
> = {
  [TaskAiUsageStatus.NOT_REGISTERED]: {
    code: 'usage_unavailable',
    message: 'The reporting client did not provide token usage.',
  },
  [TaskAiUsageStatus.PARTIAL]: {
    code: 'usage_partial',
    message: 'Some token counts were not provided by the reporting client.',
  },
  [TaskAiUsageStatus.NOT_APPLICABLE]: {
    code: 'usage_not_applicable',
    message: 'Token usage does not apply to this execution.',
  },
};

export interface TaskAiUsageExecutionResponse {
  id: string;
  taskId: string;
  provider: string | null;
  model: string | null;
  source: string | null;
  executionId: string | null;
  inputTokens: number | string | null;
  outputTokens: number | string | null;
  totalTokens: number | string | null;
  status: TaskAiUsageStatus;
  reasonCode: string | null;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskAiUsageSummary {
  status: TaskAiUsageStatus;
  executionCount: number;
  inputTokens: number | string | null;
  outputTokens: number | string | null;
  totalTokens: number | string | null;
  confirmedInputTokens: number | string | null;
  confirmedOutputTokens: number | string | null;
  confirmedTotalTokens: number | string | null;
  reasonCodes: string[];
  reasons: string[];
}

@Injectable()
export class TaskAiUsageService {
  constructor(
    @InjectRepository(TaskAiUsageExecution)
    private readonly usageRepository: Repository<TaskAiUsageExecution>,
  ) {}

  async record(
    taskId: string,
    dto: RecordTaskAiUsageDto,
  ): Promise<{
    execution: TaskAiUsageExecutionResponse;
    summary: TaskAiUsageSummary;
    idempotent: boolean;
  }> {
    const existing = dto.executionId
      ? await this.usageRepository.findOne({
          where: { taskId, executionId: dto.executionId },
        })
      : null;

    if (existing) {
      return {
        execution: this.toExecutionResponse(existing),
        summary: await this.getSummary(taskId),
        idempotent: true,
      };
    }

    const totalTokens = this.resolveTotalTokens(dto);
    if (dto.status === TaskAiUsageStatus.RECORDED && totalTokens === null) {
      throw new BadRequestException(
        'Recorded usage requires totalTokens or both inputTokens and outputTokens',
      );
    }

    const { reasonCode, reason } = this.resolveReason(
      dto.status,
      dto.reasonCode,
      dto.reason,
    );
    const execution = this.usageRepository.create({
      taskId,
      provider: dto.provider ?? null,
      model: dto.model ?? null,
      source: dto.source ?? null,
      executionId: dto.executionId ?? null,
      inputTokens: this.toStoredToken(dto.inputTokens),
      outputTokens: this.toStoredToken(dto.outputTokens),
      totalTokens: this.toStoredToken(totalTokens),
      status: dto.status,
      reasonCode,
      reason,
    });
    const saved = await this.usageRepository.save(execution);

    return {
      execution: this.toExecutionResponse(saved),
      summary: await this.getSummary(taskId),
      idempotent: false,
    };
  }

  async getUsage(taskId: string): Promise<{
    executions: TaskAiUsageExecutionResponse[];
    summary: TaskAiUsageSummary;
  }> {
    const executions = await this.usageRepository.find({
      where: { taskId },
      order: { createdAt: 'ASC' },
    });
    return {
      executions: executions.map((execution) => this.toExecutionResponse(execution)),
      summary: this.aggregate(executions),
    };
  }

  async getSummary(taskId: string): Promise<TaskAiUsageSummary> {
    const usage = await this.getUsage(taskId);
    return usage.summary;
  }

  async getSummaries(taskIds: string[]): Promise<Map<string, TaskAiUsageSummary>> {
    if (taskIds.length === 0) return new Map();
    const executions = await this.usageRepository.find({
      where: { taskId: In(taskIds) },
      order: { createdAt: 'ASC' },
    });
    const grouped = new Map<string, TaskAiUsageExecution[]>();
    for (const execution of executions) {
      const list = grouped.get(execution.taskId) || [];
      list.push(execution);
      grouped.set(execution.taskId, list);
    }
    return new Map(
      taskIds.map((taskId) => [
        taskId,
        this.aggregate(grouped.get(taskId) || []),
      ]),
    );
  }

  private resolveTotalTokens(dto: RecordTaskAiUsageDto): number | null {
    if (dto.totalTokens !== undefined && dto.totalTokens !== null) {
      return dto.totalTokens;
    }
    if (dto.inputTokens !== undefined && dto.outputTokens !== undefined) {
      const total = dto.inputTokens + dto.outputTokens;
      if (Number.isSafeInteger(total)) return total;
    }
    return null;
  }

  private resolveReason(
    status: TaskAiUsageStatus,
    reasonCode?: string,
    reason?: string,
  ): { reasonCode: string | null; reason: string | null } {
    if (status === TaskAiUsageStatus.RECORDED) {
      return { reasonCode: reasonCode ?? null, reason: reason ?? null };
    }
    const fallback = DEFAULT_REASON[status];
    return {
      reasonCode: reasonCode || fallback.code,
      reason: reason || fallback.message,
    };
  }

  private aggregate(executions: TaskAiUsageExecution[]): TaskAiUsageSummary {
    if (executions.length === 0) {
      return {
        status: TaskAiUsageStatus.NOT_REGISTERED,
        executionCount: 0,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        confirmedInputTokens: null,
        confirmedOutputTokens: null,
        confirmedTotalTokens: null,
        reasonCodes: ['no_usage_recorded'],
        reasons: ['No AI usage has been registered for this task.'],
      };
    }

    const allNotApplicable = executions.every(
      (execution) => execution.status === TaskAiUsageStatus.NOT_APPLICABLE,
    );
    const allNotRegistered = executions.every(
      (execution) => execution.status === TaskAiUsageStatus.NOT_REGISTERED,
    );
    const allRecorded = executions.every(
      (execution) =>
        execution.status === TaskAiUsageStatus.RECORDED &&
        execution.totalTokens !== null,
    );
    const status = allNotApplicable
      ? TaskAiUsageStatus.NOT_APPLICABLE
      : allNotRegistered
        ? TaskAiUsageStatus.NOT_REGISTERED
      : allRecorded
        ? TaskAiUsageStatus.RECORDED
        : TaskAiUsageStatus.PARTIAL;

    const recorded = executions.filter(
      (execution) => execution.status === TaskAiUsageStatus.RECORDED,
    );
    const reasons = [
      ...new Set(
        executions
          .map((execution) => execution.reason)
          .filter(Boolean) as string[],
      ),
    ];
    const reasonCodes = [
      ...new Set(
        executions
          .map((execution) => execution.reasonCode)
          .filter(Boolean) as string[],
      ),
    ];

    return {
      status,
      executionCount: executions.length,
      inputTokens:
        allRecorded && executions.every((execution) => execution.inputTokens !== null)
          ? this.sum(executions.map((execution) => execution.inputTokens))
          : null,
      outputTokens:
        allRecorded && executions.every((execution) => execution.outputTokens !== null)
          ? this.sum(executions.map((execution) => execution.outputTokens))
          : null,
      totalTokens: allRecorded
        ? this.sum(executions.map((execution) => execution.totalTokens))
        : null,
      confirmedInputTokens: this.sumRecordedIfKnown(
        recorded.map((execution) => execution.inputTokens),
      ),
      confirmedOutputTokens: this.sumRecordedIfKnown(
        recorded.map((execution) => execution.outputTokens),
      ),
      confirmedTotalTokens: this.sumRecordedIfKnown(
        recorded.map((execution) => execution.totalTokens),
      ),
      reasonCodes,
      reasons,
    };
  }

  private sumRecordedIfKnown(values: Array<string | null>): number | string | null {
    return values.length > 0 && values.some((value) => value !== null)
      ? this.sum(values)
      : null;
  }

  private sum(values: Array<string | null | undefined>): number | string {
    const total = values.reduce(
      (sum, value) => sum + BigInt(value ?? 0),
      0n,
    );
    return total <= MAX_SAFE_INTEGER_BIGINT ? Number(total) : total.toString();
  }

  private toStoredToken(value: number | null | undefined): string | null {
    return value === null || value === undefined ? null : String(value);
  }

  private toExecutionResponse(
    execution: TaskAiUsageExecution,
  ): TaskAiUsageExecutionResponse {
    return {
      id: execution.id,
      taskId: execution.taskId,
      provider: execution.provider,
      model: execution.model,
      source: execution.source,
      executionId: execution.executionId,
      inputTokens: this.toApiToken(execution.inputTokens),
      outputTokens: this.toApiToken(execution.outputTokens),
      totalTokens: this.toApiToken(execution.totalTokens),
      status: execution.status,
      reasonCode: execution.reasonCode,
      reason: execution.reason,
      createdAt: execution.createdAt,
      updatedAt: execution.updatedAt,
    };
  }

  private toApiToken(value: string | number | null): number | string | null {
    if (value === null || value === undefined) return null;
    const bigintValue = BigInt(value);
    return bigintValue <= MAX_SAFE_INTEGER_BIGINT
      ? Number(bigintValue)
      : bigintValue.toString();
  }
}
