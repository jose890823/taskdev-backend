import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { TaskStatus } from './entities/task-status.entity';
import { CreateTaskStatusDto, UpdateTaskStatusDto } from './dto';

@Injectable()
export class TaskStatusesService {
  private readonly logger = new Logger(TaskStatusesService.name);

  constructor(
    @InjectRepository(TaskStatus)
    private readonly statusRepository: Repository<TaskStatus>,
  ) {}

  /** Escuchar evento project.created para crear statuses default */
  @OnEvent('project.created')
  async handleProjectCreated(payload: { projectId: string }) {
    await this.createDefaultStatuses(payload.projectId);
  }

  async createDefaultStatuses(projectId: string): Promise<void> {
    const defaults = [
      { name: 'Por hacer', color: '#6b7280', position: 0, isDefault: true, isCompleted: false },
      { name: 'En progreso', color: '#f59e0b', position: 1, isDefault: false, isCompleted: false },
      { name: 'En revision', color: '#8b5cf6', position: 2, isDefault: false, isCompleted: false },
      { name: 'Completado', color: '#22c55e', position: 3, isDefault: false, isCompleted: true },
    ];

    for (const status of defaults) {
      const entity = this.statusRepository.create({ ...status, projectId });
      await this.statusRepository.save(entity);
    }
    this.logger.log(`Task statuses creados para proyecto ${projectId}`);
  }

  async createGlobalDefaults(): Promise<void> {
    const existing = await this.statusRepository.findOne({ where: { projectId: null as any } });
    if (existing) return;

    const defaults = [
      { name: 'Por hacer', color: '#6b7280', position: 0, isDefault: true, isCompleted: false },
      { name: 'En progreso', color: '#f59e0b', position: 1, isDefault: false, isCompleted: false },
      { name: 'Completado', color: '#22c55e', position: 2, isDefault: false, isCompleted: true },
    ];

    for (const status of defaults) {
      const entity = this.statusRepository.create({ ...status, projectId: null });
      await this.statusRepository.save(entity);
    }
    this.logger.log('Task statuses globales creados');
  }

  async findByProject(projectId: string): Promise<TaskStatus[]> {
    return this.statusRepository.find({
      where: { projectId },
      order: { position: 'ASC' },
    });
  }

  async findGlobal(): Promise<TaskStatus[]> {
    return this.statusRepository
      .createQueryBuilder('ts')
      .where('ts.projectId IS NULL')
      .orderBy('ts.position', 'ASC')
      .getMany();
  }

  async findById(id: string): Promise<TaskStatus> {
    const status = await this.statusRepository.findOne({ where: { id } });
    if (!status) throw new NotFoundException('Estado no encontrado');
    return status;
  }

  async create(projectId: string, dto: CreateTaskStatusDto): Promise<TaskStatus> {
    const maxPos = await this.statusRepository
      .createQueryBuilder('s')
      .where('s.projectId = :projectId', { projectId })
      .select('MAX(s.position)', 'max')
      .getRawOne();

    const status = this.statusRepository.create({
      ...dto,
      projectId,
      position: (maxPos?.max ?? -1) + 1,
    });
    return this.statusRepository.save(status);
  }

  async update(id: string, dto: UpdateTaskStatusDto): Promise<TaskStatus> {
    const status = await this.findById(id);
    Object.assign(status, dto);
    return this.statusRepository.save(status);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.statusRepository.delete(id);
  }

  async getDefaultStatus(projectId: string | null): Promise<TaskStatus | null> {
    if (projectId) {
      return this.statusRepository.findOne({
        where: { projectId, isDefault: true },
      });
    }
    return this.statusRepository
      .createQueryBuilder('ts')
      .where('ts.projectId IS NULL')
      .andWhere('ts.isDefault = :isDefault', { isDefault: true })
      .getOne();
  }
}
