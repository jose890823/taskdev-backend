import { TaskAiUsageService } from './task-ai-usage.service';
import {
  TaskAiUsageExecution,
  TaskAiUsageStatus,
} from './entities/task-ai-usage-execution.entity';

describe('TaskAiUsageService', () => {
  const repository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  let service: TaskAiUsageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TaskAiUsageService(repository as never);
  });

  it('records known usage and aggregates multiple executions', async () => {
    const first = execution({
      inputTokens: '100',
      outputTokens: '50',
      totalTokens: '150',
    });
    const second = execution({
      id: 'execution-2',
      inputTokens: '25',
      outputTokens: '10',
      totalTokens: '35',
    });
    repository.findOne.mockResolvedValue(null);
    repository.create.mockImplementation((value) => ({ ...value, ...first }));
    repository.save.mockResolvedValue(first);
    repository.find.mockResolvedValue([first, second]);

    const result = await service.record('task-1', {
      status: TaskAiUsageStatus.RECORDED,
      inputTokens: 100,
      outputTokens: 50,
      executionId: 'run-1',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ totalTokens: '150', executionId: 'run-1' }),
    );
    expect(result.summary).toMatchObject({
      status: TaskAiUsageStatus.RECORDED,
      executionCount: 2,
      inputTokens: 125,
      outputTokens: 60,
      totalTokens: 185,
    });
  });

  it('stores a deterministic fallback reason when usage is unavailable', async () => {
    const unavailable = execution({
      status: TaskAiUsageStatus.NOT_REGISTERED,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      reasonCode: 'usage_unavailable',
      reason: 'The reporting client did not provide token usage.',
    });
    repository.findOne.mockResolvedValue(null);
    repository.create.mockImplementation((value) => value);
    repository.save.mockResolvedValue(unavailable);
    repository.find.mockResolvedValue([unavailable]);

    const result = await service.record('task-1', {
      status: TaskAiUsageStatus.NOT_REGISTERED,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        reasonCode: 'usage_unavailable',
        reason: 'The reporting client did not provide token usage.',
      }),
    );
    expect(result.summary.status).toBe(TaskAiUsageStatus.NOT_REGISTERED);
    expect(result.summary.totalTokens).toBeNull();
  });

  it('returns the existing execution for a repeated executionId', async () => {
    const existing = execution({ executionId: 'run-1' });
    repository.findOne.mockResolvedValue(existing);
    repository.find.mockResolvedValue([existing]);

    const result = await service.record('task-1', {
      status: TaskAiUsageStatus.RECORDED,
      executionId: 'run-1',
      totalTokens: 10,
    });

    expect(result.idempotent).toBe(true);
    expect(repository.save).not.toHaveBeenCalled();
    expect(result.execution.id).toBe(existing.id);
  });
});

function execution(
  overrides: Partial<TaskAiUsageExecution> = {},
): TaskAiUsageExecution {
  return {
    id: 'execution-1',
    taskId: 'task-1',
    provider: null,
    model: null,
    source: null,
    executionId: null,
    inputTokens: '100',
    outputTokens: '50',
    totalTokens: '150',
    status: TaskAiUsageStatus.RECORDED,
    reasonCode: null,
    reason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as TaskAiUsageExecution;
}
