import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Mapeo de prefijos de systemCode a tablas y tipos de entidad
 */
const PREFIX_MAP: Record<string, { table: string; type: string }> = {
  ORG: { table: 'organizations', type: 'organization' },
  PRJ: { table: 'projects', type: 'project' },
  TSK: { table: 'tasks', type: 'task' },
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

    const result = await this.dataSource.query(
      `SELECT * FROM "${mapping.table}" WHERE "systemCode" = $1 AND "deletedAt" IS NULL LIMIT 1`,
      [code],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(`No se encontro ${mapping.type} con codigo "${code}"`);
    }

    return { type: mapping.type, data: result[0] };
  }
}
