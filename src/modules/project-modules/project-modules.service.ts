import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
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
    const parentId = dto.parentId || null;

    if (parentId) {
      const parent = await this.moduleRepository.findOne({ where: { id: parentId } });
      if (!parent) {
        throw new NotFoundException('Modulo padre no encontrado');
      }
      if (parent.projectId !== projectId) {
        throw new BadRequestException('El modulo padre no pertenece a este proyecto');
      }
      const depth = await this.getModuleDepth(parent);
      if (depth >= 2) {
        throw new BadRequestException('Se alcanzo el limite maximo de profundidad (3 niveles)');
      }
    }

    const maxPos = await this.moduleRepository
      .createQueryBuilder('m')
      .where('m.projectId = :projectId', { projectId })
      .andWhere(parentId ? 'm.parentId = :parentId' : 'm.parentId IS NULL', { parentId })
      .select('MAX(m.position)', 'max')
      .getRawOne();

    const mod = this.moduleRepository.create({
      ...dto,
      projectId,
      parentId,
      position: (maxPos?.max ?? -1) + 1,
    });
    return this.moduleRepository.save(mod);
  }

  async findByProject(projectId: string): Promise<ProjectModule[]> {
    const all = await this.moduleRepository.find({
      where: { projectId },
      order: { position: 'ASC' },
    });
    return this.buildTree(all);
  }

  async findAllFlat(projectId: string): Promise<ProjectModule[]> {
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
    const mod = await this.findById(id);
    const descendantIds = await this.getDescendantIds(mod.id);
    const allIds = [id, ...descendantIds];
    await this.moduleRepository.softDelete(allIds);
  }

  async reorder(dto: ReorderModulesDto): Promise<void> {
    for (let i = 0; i < dto.ids.length; i++) {
      await this.moduleRepository.update(dto.ids[i], { position: i });
    }
  }

  // ── Private helpers ──

  private async getModuleDepth(mod: ProjectModule): Promise<number> {
    let depth = 0;
    let currentParentId = mod.parentId;
    while (currentParentId) {
      depth++;
      const parent = await this.moduleRepository.findOne({ where: { id: currentParentId } });
      currentParentId = parent?.parentId || null;
    }
    return depth;
  }

  private buildTree(modules: ProjectModule[]): any[] {
    // Convert TypeORM entities to plain objects (spread misses relation-managed columns like parentId)
    const plain = JSON.parse(JSON.stringify(modules));

    const map = new Map<string, any>();
    const roots: any[] = [];

    for (const m of plain) {
      map.set(m.id, { ...m, children: [] });
    }

    for (const m of plain) {
      const node = map.get(m.id)!;
      if (m.parentId && map.has(m.parentId)) {
        map.get(m.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  private async getDescendantIds(parentId: string): Promise<string[]> {
    const children = await this.moduleRepository.find({
      where: { parentId },
      select: ['id'],
    });
    const ids: string[] = [];
    for (const child of children) {
      ids.push(child.id);
      const grandChildren = await this.getDescendantIds(child.id);
      ids.push(...grandChildren);
    }
    return ids;
  }
}
