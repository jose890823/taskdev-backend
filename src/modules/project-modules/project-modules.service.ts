import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectModule } from './entities/project-module.entity';
import { CreateProjectModuleDto, UpdateProjectModuleDto, ReorderModulesDto } from './dto';

@Injectable()
export class ProjectModulesService {
  private readonly logger = new Logger(ProjectModulesService.name);

  constructor(
    @InjectRepository(ProjectModule)
    private readonly moduleRepository: Repository<ProjectModule>,
  ) {}

  async create(projectId: string, dto: CreateProjectModuleDto): Promise<ProjectModule> {
    const maxPos = await this.moduleRepository
      .createQueryBuilder('m')
      .where('m.projectId = :projectId', { projectId })
      .select('MAX(m.position)', 'max')
      .getRawOne();

    const mod = this.moduleRepository.create({
      ...dto,
      projectId,
      position: (maxPos?.max ?? -1) + 1,
    });
    return this.moduleRepository.save(mod);
  }

  async findByProject(projectId: string): Promise<ProjectModule[]> {
    return this.moduleRepository.find({
      where: { projectId },
      order: { position: 'ASC' },
    });
  }

  async findById(id: string): Promise<ProjectModule> {
    const mod = await this.moduleRepository.findOne({ where: { id } });
    if (!mod) throw new NotFoundException('Modulo no encontrado');
    return mod;
  }

  async update(id: string, dto: UpdateProjectModuleDto): Promise<ProjectModule> {
    const mod = await this.findById(id);
    Object.assign(mod, dto);
    return this.moduleRepository.save(mod);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.moduleRepository.softDelete(id);
  }

  async reorder(dto: ReorderModulesDto): Promise<void> {
    for (let i = 0; i < dto.ids.length; i++) {
      await this.moduleRepository.update(dto.ids[i], { position: i });
    }
  }
}
