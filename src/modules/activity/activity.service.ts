import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ActivityLog, ActivityType } from './entities/activity-log.entity';

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityRepository: Repository<ActivityLog>,
  ) {}

  async log(params: {
    userId: string;
    type: ActivityType;
    description: string;
    organizationId?: string;
    projectId?: string;
    taskId?: string;
    metadata?: Record<string, any>;
  }): Promise<ActivityLog> {
    const entry = this.activityRepository.create({
      userId: params.userId,
      type: params.type,
      description: params.description,
      organizationId: params.organizationId ?? null,
      projectId: params.projectId ?? null,
      taskId: params.taskId ?? null,
      metadata: params.metadata ?? null,
    });
    await this.activityRepository.save(entry);
    return entry;
  }

  async findByProject(projectId: string, page = 1, limit = 20): Promise<{ data: ActivityLog[]; total: number }> {
    const [data, total] = await this.activityRepository.findAndCount({
      where: { projectId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findByOrganization(organizationId: string, page = 1, limit = 20): Promise<{ data: ActivityLog[]; total: number }> {
    const [data, total] = await this.activityRepository.findAndCount({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findByUser(userId: string, page = 1, limit = 20): Promise<{ data: ActivityLog[]; total: number }> {
    const [data, total] = await this.activityRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async getDailySummary(userId: string, date?: string): Promise<ActivityLog[]> {
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    return this.activityRepository.find({
      where: {
        userId,
        createdAt: Between(start, end),
      },
      order: { createdAt: 'ASC' },
    });
  }
}
