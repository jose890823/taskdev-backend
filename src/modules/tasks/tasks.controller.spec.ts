import { ForbiddenException } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TaskAiUsageStatus } from './entities/task-ai-usage-execution.entity';

describe('TasksController AI usage routes', () => {
  const tasksService = {
    verifyTaskAccess: jest.fn(),
  };
  const usageService = {
    record: jest.fn(),
    getUsage: jest.fn(),
  };
  const controller = new TasksController(
    tasksService as never,
    usageService as never,
  );
  const user = {
    id: 'user-1',
    isSuperAdmin: () => false,
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses task access and API-key project binding before recording usage', async () => {
    const task = { id: 'task-1', projectId: 'project-1' };
    tasksService.verifyTaskAccess.mockResolvedValue(task);
    usageService.record.mockResolvedValue({
      idempotent: false,
      execution: {},
      summary: { status: TaskAiUsageStatus.RECORDED },
    });
    const request = {
      identity: { authType: 'api-key', projectId: 'project-1' },
    };
    const dto = { status: TaskAiUsageStatus.RECORDED, totalTokens: 12 };

    await controller.recordAiUsage('TSK-260218-A1B2', dto as never, user, request as never);

    expect(tasksService.verifyTaskAccess).toHaveBeenCalledWith(
      'TSK-260218-A1B2',
      'user-1',
      false,
      'project-1',
    );
    expect(usageService.record).toHaveBeenCalledWith('task-1', dto);
  });

  it('rejects a task resolved outside the API-key project binding', async () => {
    tasksService.verifyTaskAccess.mockResolvedValue({
      id: 'task-1',
      projectId: 'project-2',
    });
    const request = {
      identity: { authType: 'api-key', projectId: 'project-1' },
    };

    await expect(
      controller.getAiUsage('task-1', user, request as never),
    ).rejects.toThrow(ForbiddenException);
    expect(usageService.getUsage).not.toHaveBeenCalled();
  });
});
