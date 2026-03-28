import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Mapeo de prefijos de systemCode a tablas, tipos y columnas seleccionadas
 */
const PREFIX_MAP: Record<
  string,
  { table: string; type: string; columns: string[] }
> = {
  ORG: {
    table: 'organizations',
    type: 'organization',
    columns: [
      'id',
      'systemCode',
      'name',
      'slug',
      'description',
      'ownerId',
      'isActive',
      'createdAt',
    ],
  },
  PRJ: {
    table: 'projects',
    type: 'project',
    columns: [
      'id',
      'systemCode',
      'name',
      'slug',
      'description',
      'color',
      'ownerId',
      'organizationId',
      'parentId',
      'isActive',
      'createdAt',
    ],
  },
  TSK: {
    table: 'tasks',
    type: 'task',
    columns: [
      'id',
      'systemCode',
      'title',
      'description',
      'type',
      'priority',
      'projectId',
      'organizationId',
      'assignedToId',
      'createdById',
      'statusId',
      'scheduledDate',
      'dueDate',
      'completedAt',
      'createdAt',
    ],
  },
};

@Injectable()
export class SearchService {
  constructor(private readonly dataSource: DataSource) {}

  async findByCode(code: string): Promise<{ type: string; data: any }> {
    if (!code || code.length < 3) {
      throw new BadRequestException('Codigo invalido');
    }

    const prefix = code.split('-')[0]?.toUpperCase();
    const mapping = PREFIX_MAP[prefix];

    if (!mapping) {
      throw new BadRequestException(
        `Prefijo "${prefix}" no reconocido. Prefijos validos: ${Object.keys(PREFIX_MAP).join(', ')}`,
      );
    }

    const columns = mapping.columns.map((c) => `"${c}"`).join(', ');
    const result = await this.dataSource.query<Record<string, unknown>[]>(
      `SELECT ${columns} FROM "${mapping.table}" WHERE "systemCode" = $1 AND "deletedAt" IS NULL LIMIT 1`,
      [code],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(
        `No se encontro ${mapping.type} con codigo "${code}"`,
      );
    }

    return { type: mapping.type, data: result[0] };
  }
}
