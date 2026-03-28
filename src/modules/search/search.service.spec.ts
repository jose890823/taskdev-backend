import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;
  let dataSource: jest.Mocked<DataSource>;

  const orgId = '123e4567-e89b-12d3-a456-426614174000';
  const projectId = '223e4567-e89b-12d3-a456-426614174001';
  const taskId = '323e4567-e89b-12d3-a456-426614174002';

  const mockOrganization = {
    id: orgId,
    systemCode: 'ORG-260218-B2C3',
    name: 'Mi Organizacion',
    slug: 'mi-organizacion',
    description: 'Descripcion de la org',
    ownerId: '423e4567-e89b-12d3-a456-426614174003',
    isActive: true,
    createdAt: new Date('2026-02-18T10:00:00.000Z'),
  };

  const mockProject = {
    id: projectId,
    systemCode: 'PRJ-260218-D4F1',
    name: 'Mi Proyecto',
    slug: 'mi-proyecto',
    description: 'Un proyecto de prueba',
    color: '#FF5733',
    ownerId: '423e4567-e89b-12d3-a456-426614174003',
    organizationId: orgId,
    parentId: null,
    isActive: true,
    createdAt: new Date('2026-02-18T10:00:00.000Z'),
  };

  const mockTask = {
    id: taskId,
    systemCode: 'TSK-260218-A3K7',
    title: 'Implementar login',
    description: 'Implementar el flujo de login con JWT',
    type: 'project',
    priority: 'high',
    projectId,
    organizationId: orgId,
    assignedToId: '523e4567-e89b-12d3-a456-426614174004',
    createdById: '423e4567-e89b-12d3-a456-426614174003',
    statusId: '623e4567-e89b-12d3-a456-426614174005',
    scheduledDate: null,
    dueDate: '2026-03-01',
    completedAt: null,
    createdAt: new Date('2026-02-18T10:00:00.000Z'),
  };

  beforeEach(async () => {
    const mockDataSource = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  // ───────────────────────────────────────────────
  // findByCode()
  // ───────────────────────────────────────────────
  describe('findByCode', () => {
    // --- Happy path: Organization ---
    it('debe encontrar una organizacion por systemCode', async () => {
      dataSource.query.mockResolvedValue([mockOrganization]);

      const result = await service.findByCode('ORG-260218-B2C3');

      expect(result).toEqual({
        type: 'organization',
        data: mockOrganization,
      });
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('"organizations"'),
        ['ORG-260218-B2C3'],
      );
    });

    // --- Happy path: Project ---
    it('debe encontrar un proyecto por systemCode', async () => {
      dataSource.query.mockResolvedValue([mockProject]);

      const result = await service.findByCode('PRJ-260218-D4F1');

      expect(result).toEqual({
        type: 'project',
        data: mockProject,
      });
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('"projects"'),
        ['PRJ-260218-D4F1'],
      );
    });

    // --- Happy path: Task ---
    it('debe encontrar una tarea por systemCode', async () => {
      dataSource.query.mockResolvedValue([mockTask]);

      const result = await service.findByCode('TSK-260218-A3K7');

      expect(result).toEqual({
        type: 'task',
        data: mockTask,
      });
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('"tasks"'),
        ['TSK-260218-A3K7'],
      );
    });

    // --- Case insensitivity for prefix ---
    it('debe manejar prefijos en minuscula', async () => {
      dataSource.query.mockResolvedValue([mockTask]);

      const result = await service.findByCode('tsk-260218-A3K7');

      expect(result.type).toBe('task');
    });

    it('debe manejar prefijos en mixed case', async () => {
      dataSource.query.mockResolvedValue([mockOrganization]);

      const result = await service.findByCode('Org-260218-B2C3');

      expect(result.type).toBe('organization');
    });

    // --- SQL query structure ---
    it('debe construir la query SQL con las columnas correctas para organizaciones', async () => {
      dataSource.query.mockResolvedValue([mockOrganization]);

      await service.findByCode('ORG-260218-B2C3');

      const queryArg = dataSource.query.mock.calls[0][0] as string;
      expect(queryArg).toContain('"id"');
      expect(queryArg).toContain('"systemCode"');
      expect(queryArg).toContain('"name"');
      expect(queryArg).toContain('"slug"');
      expect(queryArg).toContain('"ownerId"');
      expect(queryArg).toContain('"isActive"');
      expect(queryArg).toContain('"deletedAt" IS NULL');
      expect(queryArg).toContain('LIMIT 1');
    });

    it('debe construir la query SQL con las columnas correctas para tareas', async () => {
      dataSource.query.mockResolvedValue([mockTask]);

      await service.findByCode('TSK-260218-A3K7');

      const queryArg = dataSource.query.mock.calls[0][0] as string;
      expect(queryArg).toContain('"title"');
      expect(queryArg).toContain('"priority"');
      expect(queryArg).toContain('"assignedToId"');
      expect(queryArg).toContain('"createdById"');
      expect(queryArg).toContain('"statusId"');
      expect(queryArg).toContain('"dueDate"');
      expect(queryArg).toContain('"completedAt"');
    });

    it('debe construir la query SQL con las columnas correctas para proyectos', async () => {
      dataSource.query.mockResolvedValue([mockProject]);

      await service.findByCode('PRJ-260218-D4F1');

      const queryArg = dataSource.query.mock.calls[0][0] as string;
      expect(queryArg).toContain('"color"');
      expect(queryArg).toContain('"organizationId"');
      expect(queryArg).toContain('"parentId"');
    });

    it('debe usar parametro $1 para prevenir SQL injection', async () => {
      dataSource.query.mockResolvedValue([mockTask]);

      await service.findByCode('TSK-260218-A3K7');

      const queryArg = dataSource.query.mock.calls[0][0] as string;
      const paramsArg = dataSource.query.mock.calls[0][1];
      expect(queryArg).toContain('$1');
      expect(paramsArg).toEqual(['TSK-260218-A3K7']);
    });

    it('debe filtrar registros soft-deleted con deletedAt IS NULL', async () => {
      dataSource.query.mockResolvedValue([mockOrganization]);

      await service.findByCode('ORG-260218-B2C3');

      const queryArg = dataSource.query.mock.calls[0][0] as string;
      expect(queryArg).toContain('"deletedAt" IS NULL');
    });

    // --- Error: codigo null o vacio ---
    it('debe lanzar BadRequestException si el codigo es null', async () => {
      await expect(service.findByCode(null as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findByCode(null as any)).rejects.toThrow(
        'Codigo invalido',
      );
    });

    it('debe lanzar BadRequestException si el codigo es string vacio', async () => {
      await expect(service.findByCode('')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findByCode('')).rejects.toThrow(
        'Codigo invalido',
      );
    });

    it('debe lanzar BadRequestException si el codigo tiene menos de 3 caracteres', async () => {
      await expect(service.findByCode('AB')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findByCode('AB')).rejects.toThrow(
        'Codigo invalido',
      );
    });

    it('debe lanzar BadRequestException si el codigo es undefined', async () => {
      await expect(service.findByCode(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    // --- Error: prefijo no reconocido ---
    it('debe lanzar BadRequestException con prefijo desconocido', async () => {
      await expect(service.findByCode('XYZ-260218-A3K7')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findByCode('XYZ-260218-A3K7')).rejects.toThrow(
        'Prefijo "XYZ" no reconocido',
      );
    });

    it('debe incluir prefijos validos en el mensaje de error de prefijo desconocido', async () => {
      try {
        await service.findByCode('USR-260218-A3K7');
      } catch (error) {
        expect(error.message).toContain('ORG');
        expect(error.message).toContain('PRJ');
        expect(error.message).toContain('TSK');
      }
    });

    // --- Error: entidad no encontrada ---
    it('debe lanzar NotFoundException si no se encuentra la entidad', async () => {
      dataSource.query.mockResolvedValue([]);

      await expect(service.findByCode('TSK-999999-XXXX')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findByCode('TSK-999999-XXXX')).rejects.toThrow(
        'No se encontro task con codigo "TSK-999999-XXXX"',
      );
    });

    it('debe lanzar NotFoundException si query retorna null', async () => {
      dataSource.query.mockResolvedValue(null);

      await expect(service.findByCode('ORG-260218-B2C3')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debe lanzar NotFoundException con mensaje que incluye el tipo correcto', async () => {
      dataSource.query.mockResolvedValue([]);

      await expect(service.findByCode('ORG-260218-ZZZZ')).rejects.toThrow(
        'No se encontro organization con codigo "ORG-260218-ZZZZ"',
      );

      await expect(service.findByCode('PRJ-260218-ZZZZ')).rejects.toThrow(
        'No se encontro project con codigo "PRJ-260218-ZZZZ"',
      );
    });

    // --- Edge: codigo con formato raro pero prefijo valido ---
    it('debe manejar codigo sin guiones pero con prefijo de 3+ chars', async () => {
      // "TSKXXXXXX" -> prefix = "TSKXXXXXX" (split('-')[0]) -> toUpperCase
      // This won't match PREFIX_MAP since key is just "TSK"
      await expect(service.findByCode('TSKXXXXXX')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe retornar solo el primer resultado (LIMIT 1)', async () => {
      dataSource.query.mockResolvedValue([mockTask, { ...mockTask, id: 'otro-id' }]);

      const result = await service.findByCode('TSK-260218-A3K7');

      // Service uses result[0], so it returns first
      expect(result.data).toEqual(mockTask);
    });
  });
});
