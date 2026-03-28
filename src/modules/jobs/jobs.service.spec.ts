import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { Repository } from 'typeorm';
import { JobsService } from './jobs.service';
import {
  JobExecution,
  JobExecutionStatus,
  JobName,
} from './entities/job-execution.entity';
import { JobFilterDto } from './dto/job-filter.dto';

describe('JobsService', () => {
  let service: JobsService;
  let jobExecutionRepository: jest.Mocked<Repository<JobExecution>>;
  let mockQueue: Record<string, jest.Mock>;

  const mockExecutionId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUserId = '223e4567-e89b-12d3-a456-426614174001';

  const mockExecution: JobExecution = {
    id: mockExecutionId,
    jobName: 'test-job',
    queueName: 'michambita-jobs',
    status: JobExecutionStatus.PENDING,
    input: null,
    result: null,
    errorMessage: null,
    errorStack: null,
    attemptNumber: 0,
    durationMs: null,
    triggeredBy: null,
    startedAt: new Date('2026-03-28T10:00:00Z'),
    completedAt: null,
  } as JobExecution;

  beforeEach(async () => {
    const mockJobExecutionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockQueue = {
      getRepeatableJobs: jest.fn().mockResolvedValue([]),
      removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
      add: jest.fn().mockResolvedValue({ id: 'bull-job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        {
          provide: getRepositoryToken(JobExecution),
          useValue: mockJobExecutionRepository,
        },
        {
          provide: getQueueToken('michambita-jobs'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    jobExecutionRepository = module.get(getRepositoryToken(JobExecution));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  // ============================================
  // ON MODULE INIT
  // ============================================

  describe('onModuleInit', () => {
    it('debe limpiar jobs repetibles existentes al inicializar', async () => {
      const repeatableJobs = [
        { key: 'job1-key', name: 'job1' },
        { key: 'job2-key', name: 'job2' },
      ];
      mockQueue.getRepeatableJobs.mockResolvedValue(repeatableJobs);

      await service.onModuleInit();

      expect(mockQueue.getRepeatableJobs).toHaveBeenCalled();
      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledTimes(2);
      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith('job1-key');
      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith('job2-key');
    });

    it('debe funcionar correctamente cuando no hay jobs repetibles', async () => {
      mockQueue.getRepeatableJobs.mockResolvedValue([]);

      await service.onModuleInit();

      expect(mockQueue.getRepeatableJobs).toHaveBeenCalled();
      expect(mockQueue.removeRepeatableByKey).not.toHaveBeenCalled();
    });

    it('debe no lanzar error cuando la conexion a Redis falla', async () => {
      mockQueue.getRepeatableJobs.mockRejectedValue(
        new Error('Redis connection refused'),
      );

      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });
  });

  // ============================================
  // TRIGGER JOB
  // ============================================

  describe('triggerJob', () => {
    it('debe crear una ejecucion y agregar job a la cola', async () => {
      const jobName = 'test-job' as unknown as JobName;
      const savedExecution = { ...mockExecution, triggeredBy: mockUserId };

      jobExecutionRepository.create.mockReturnValue(
        savedExecution as JobExecution,
      );
      jobExecutionRepository.save.mockResolvedValue(
        savedExecution as JobExecution,
      );

      const result = await service.triggerJob(jobName, mockUserId);

      expect(jobExecutionRepository.create).toHaveBeenCalledWith({
        jobName: 'test-job',
        queueName: 'michambita-jobs',
        status: JobExecutionStatus.PENDING,
        input: null,
        triggeredBy: mockUserId,
      });
      expect(jobExecutionRepository.save).toHaveBeenCalledWith(savedExecution);
      expect(mockQueue.add).toHaveBeenCalledWith('test-job', {
        _executionId: savedExecution.id,
        _triggeredBy: mockUserId,
      });
      expect(result).toEqual(savedExecution);
    });

    it('debe manejar input personalizado', async () => {
      const jobName = 'test-job' as unknown as JobName;
      const input = { targetId: 'abc', force: true };
      const savedExecution = {
        ...mockExecution,
        input,
        triggeredBy: mockUserId,
      };

      jobExecutionRepository.create.mockReturnValue(
        savedExecution as JobExecution,
      );
      jobExecutionRepository.save.mockResolvedValue(
        savedExecution as JobExecution,
      );

      const result = await service.triggerJob(jobName, mockUserId, input);

      expect(jobExecutionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ input }),
      );
      expect(mockQueue.add).toHaveBeenCalledWith('test-job', {
        ...input,
        _executionId: savedExecution.id,
        _triggeredBy: mockUserId,
      });
      expect(result.input).toEqual(input);
    });

    it('debe funcionar sin triggeredBy (disparo por sistema)', async () => {
      const jobName = 'test-job' as unknown as JobName;
      const savedExecution = { ...mockExecution, triggeredBy: null };

      jobExecutionRepository.create.mockReturnValue(
        savedExecution as JobExecution,
      );
      jobExecutionRepository.save.mockResolvedValue(
        savedExecution as JobExecution,
      );

      const result = await service.triggerJob(jobName);

      expect(jobExecutionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          triggeredBy: null,
          input: null,
        }),
      );
      expect(mockQueue.add).toHaveBeenCalledWith('test-job', {
        _executionId: savedExecution.id,
        _triggeredBy: undefined,
      });
      expect(result.triggeredBy).toBeNull();
    });

    it('debe funcionar sin triggeredBy ni input', async () => {
      const jobName = 'test-job' as unknown as JobName;
      const savedExecution = { ...mockExecution };

      jobExecutionRepository.create.mockReturnValue(
        savedExecution as JobExecution,
      );
      jobExecutionRepository.save.mockResolvedValue(
        savedExecution as JobExecution,
      );

      const result = await service.triggerJob(jobName, undefined, undefined);

      expect(jobExecutionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          triggeredBy: null,
          input: null,
        }),
      );
      expect(result).toEqual(savedExecution);
    });
  });

  // ============================================
  // GET EXECUTIONS
  // ============================================

  describe('getExecutions', () => {
    const createMockQueryBuilder = (data: JobExecution[], total: number) => ({
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([data, total]),
    });

    it('debe retornar ejecuciones con paginacion por defecto', async () => {
      const filters: JobFilterDto = {};
      const mockQb = createMockQueryBuilder([mockExecution], 1);
      jobExecutionRepository.createQueryBuilder.mockReturnValue(
        mockQb as any,
      );

      const result = await service.getExecutions(filters);

      expect(result.data).toEqual([mockExecution]);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(mockQb.orderBy).toHaveBeenCalledWith(
        'execution.startedAt',
        'DESC',
      );
      expect(mockQb.skip).toHaveBeenCalledWith(0);
      expect(mockQb.take).toHaveBeenCalledWith(20);
    });

    it('debe aplicar paginacion personalizada', async () => {
      const filters: JobFilterDto = { page: 3, limit: 10 };
      const mockQb = createMockQueryBuilder([], 25);
      jobExecutionRepository.createQueryBuilder.mockReturnValue(
        mockQb as any,
      );

      const result = await service.getExecutions(filters);

      expect(mockQb.skip).toHaveBeenCalledWith(20); // (3-1) * 10
      expect(mockQb.take).toHaveBeenCalledWith(10);
      expect(result.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
    });

    it('debe filtrar por jobName', async () => {
      const filters: JobFilterDto = {
        jobName: 'test-job' as unknown as JobName,
      };
      const mockQb = createMockQueryBuilder([], 0);
      jobExecutionRepository.createQueryBuilder.mockReturnValue(
        mockQb as any,
      );

      await service.getExecutions(filters);

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'execution.jobName = :jobName',
        { jobName: 'test-job' },
      );
    });

    it('debe filtrar por status', async () => {
      const filters: JobFilterDto = { status: JobExecutionStatus.COMPLETED };
      const mockQb = createMockQueryBuilder([], 0);
      jobExecutionRepository.createQueryBuilder.mockReturnValue(
        mockQb as any,
      );

      await service.getExecutions(filters);

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'execution.status = :status',
        { status: JobExecutionStatus.COMPLETED },
      );
    });

    it('debe filtrar por queueName', async () => {
      const filters: JobFilterDto = { queueName: 'michambita-jobs' };
      const mockQb = createMockQueryBuilder([], 0);
      jobExecutionRepository.createQueryBuilder.mockReturnValue(
        mockQb as any,
      );

      await service.getExecutions(filters);

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'execution.queueName = :queueName',
        { queueName: 'michambita-jobs' },
      );
    });

    it('debe filtrar por rango de fechas', async () => {
      const filters: JobFilterDto = {
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
      };
      const mockQb = createMockQueryBuilder([], 0);
      jobExecutionRepository.createQueryBuilder.mockReturnValue(
        mockQb as any,
      );

      await service.getExecutions(filters);

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'execution.startedAt >= :fromDate',
        { fromDate: '2026-01-01' },
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'execution.startedAt <= :toDate',
        { toDate: '2026-12-31' },
      );
    });

    it('debe aplicar ordenamiento personalizado', async () => {
      const filters: JobFilterDto = { sortBy: 'jobName', sortOrder: 'ASC' };
      const mockQb = createMockQueryBuilder([], 0);
      jobExecutionRepository.createQueryBuilder.mockReturnValue(
        mockQb as any,
      );

      await service.getExecutions(filters);

      expect(mockQb.orderBy).toHaveBeenCalledWith(
        'execution.jobName',
        'ASC',
      );
    });

    it('debe combinar multiples filtros simultaneamente', async () => {
      const filters: JobFilterDto = {
        jobName: 'test-job' as unknown as JobName,
        status: JobExecutionStatus.FAILED,
        queueName: 'michambita-jobs',
        fromDate: '2026-01-01',
        toDate: '2026-06-30',
        page: 2,
        limit: 5,
        sortBy: 'completedAt',
        sortOrder: 'ASC',
      };
      const mockQb = createMockQueryBuilder([], 12);
      jobExecutionRepository.createQueryBuilder.mockReturnValue(
        mockQb as any,
      );

      const result = await service.getExecutions(filters);

      expect(mockQb.andWhere).toHaveBeenCalledTimes(5); // jobName, status, queueName, fromDate, toDate
      expect(mockQb.orderBy).toHaveBeenCalledWith(
        'execution.completedAt',
        'ASC',
      );
      expect(mockQb.skip).toHaveBeenCalledWith(5); // (2-1) * 5
      expect(mockQb.take).toHaveBeenCalledWith(5);
      expect(result.pagination.totalPages).toBe(3); // ceil(12/5)
    });

    it('debe retornar lista vacia cuando no hay resultados', async () => {
      const filters: JobFilterDto = {};
      const mockQb = createMockQueryBuilder([], 0);
      jobExecutionRepository.createQueryBuilder.mockReturnValue(
        mockQb as any,
      );

      const result = await service.getExecutions(filters);

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('debe calcular totalPages correctamente con resultados no exactos', async () => {
      const filters: JobFilterDto = { limit: 10 };
      const mockQb = createMockQueryBuilder([], 23);
      jobExecutionRepository.createQueryBuilder.mockReturnValue(
        mockQb as any,
      );

      const result = await service.getExecutions(filters);

      expect(result.pagination.totalPages).toBe(3); // ceil(23/10)
    });
  });

  // ============================================
  // GET JOB STATUSES
  // ============================================

  describe('getJobStatuses', () => {
    it('debe retornar el ultimo estado de cada job', async () => {
      // JobName enum esta vacio en este proyecto, asi que
      // Object.values(JobName) retorna []
      const result = await service.getJobStatuses();

      expect(result).toEqual({});
    });

    it('debe buscar la ejecucion mas reciente para cada JobName', async () => {
      // Simular que JobName tiene valores inyectando datos
      const originalValues = Object.values;
      const mockJobNames = ['test-job', 'cleanup-job'];
      jest
        .spyOn(Object, 'values')
        .mockImplementation((obj: Record<string, unknown>) => {
          if (obj === JobName) return mockJobNames as any;
          return originalValues(obj);
        });

      jobExecutionRepository.findOne
        .mockResolvedValueOnce(mockExecution)
        .mockResolvedValueOnce(null);

      const result = await service.getJobStatuses();

      expect(result['test-job']).toEqual(mockExecution);
      expect(result['cleanup-job']).toBeNull();
      expect(jobExecutionRepository.findOne).toHaveBeenCalledTimes(2);
      expect(jobExecutionRepository.findOne).toHaveBeenCalledWith({
        where: { jobName: 'test-job' },
        order: { startedAt: 'DESC' },
      });
    });
  });

  // ============================================
  // GET EXECUTION
  // ============================================

  describe('getExecution', () => {
    it('debe retornar la ejecucion cuando existe', async () => {
      jobExecutionRepository.findOne.mockResolvedValue(mockExecution);

      const result = await service.getExecution(mockExecutionId);

      expect(result).toEqual(mockExecution);
      expect(jobExecutionRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockExecutionId },
      });
    });

    it('debe lanzar NotFoundException cuando la ejecucion no existe', async () => {
      jobExecutionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getExecution('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getExecution('non-existent-id'),
      ).rejects.toThrow(
        'Ejecucion de job con ID non-existent-id no encontrada',
      );
    });
  });

  // ============================================
  // CLEAN OLD EXECUTIONS
  // ============================================

  describe('cleanOldExecutions', () => {
    it('debe eliminar ejecuciones antiguas y retornar cantidad', async () => {
      const mockQb = {
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 15 }),
      };
      jobExecutionRepository.createQueryBuilder.mockReturnValue(
        mockQb as any,
      );

      const result = await service.cleanOldExecutions();

      expect(result).toBe(15);
      expect(mockQb.delete).toHaveBeenCalled();
      expect(mockQb.from).toHaveBeenCalledWith(JobExecution);
      expect(mockQb.where).toHaveBeenCalledWith(
        "startedAt < NOW() - INTERVAL '30 days'",
      );
      expect(mockQb.execute).toHaveBeenCalled();
    });

    it('debe retornar 0 cuando no hay ejecuciones antiguas', async () => {
      const mockQb = {
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      jobExecutionRepository.createQueryBuilder.mockReturnValue(
        mockQb as any,
      );

      const result = await service.cleanOldExecutions();

      expect(result).toBe(0);
    });

    it('debe retornar 0 cuando affected es null/undefined', async () => {
      const mockQb = {
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: null }),
      };
      jobExecutionRepository.createQueryBuilder.mockReturnValue(
        mockQb as any,
      );

      const result = await service.cleanOldExecutions();

      expect(result).toBe(0);
    });
  });
});
