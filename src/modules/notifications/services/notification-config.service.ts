import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEventConfig } from '../entities/notification-event-config.entity';
import { UpdateEventConfigDto } from '../dto/update-event-config.dto';

/**
 * Seed data para los eventos de notificación
 */
const EVENT_SEEDS: Array<{
  eventType: string;
  label: string;
  description: string;
  isEnabled: boolean;
  category: string;
}> = [
  { eventType: 'task_assigned', label: 'Tarea asignada', description: 'Cuando un usuario es asignado a una tarea', isEnabled: true, category: 'tasks' },
  { eventType: 'task_unassigned', label: 'Tarea desasignada', description: 'Cuando un usuario es removido de una tarea', isEnabled: true, category: 'tasks' },
  { eventType: 'task_status_changed', label: 'Estado de tarea cambiado', description: 'Cuando cambia el estado de una tarea', isEnabled: true, category: 'tasks' },
  { eventType: 'task_completed', label: 'Tarea completada', description: 'Cuando una tarea se marca como completada', isEnabled: true, category: 'tasks' },
  { eventType: 'task_commented', label: 'Comentario en tarea', description: 'Cuando alguien comenta en una tarea', isEnabled: true, category: 'tasks' },
  { eventType: 'task_due_soon', label: 'Tarea por vencer', description: 'Cuando una tarea esta proxima a su fecha limite', isEnabled: false, category: 'tasks' },
  { eventType: 'subtask_created', label: 'Subtarea creada', description: 'Cuando se crea una subtarea', isEnabled: true, category: 'tasks' },
  { eventType: 'project_member_added', label: 'Agregado a proyecto', description: 'Cuando un usuario es agregado a un proyecto', isEnabled: true, category: 'projects' },
  { eventType: 'project_member_removed', label: 'Removido de proyecto', description: 'Cuando un usuario es removido de un proyecto', isEnabled: true, category: 'projects' },
  { eventType: 'org_member_added', label: 'Agregado a organizacion', description: 'Cuando un usuario es agregado a una organizacion', isEnabled: true, category: 'organizations' },
  { eventType: 'org_invitation_received', label: 'Invitacion recibida', description: 'Cuando un usuario recibe una invitacion a una organizacion', isEnabled: true, category: 'organizations' },
];

@Injectable()
export class NotificationConfigService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationConfigService.name);
  private configCache: Map<string, boolean> = new Map();

  constructor(
    @InjectRepository(NotificationEventConfig)
    private readonly configRepository: Repository<NotificationEventConfig>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedEventConfigs();
    await this.refreshCache();
  }

  /**
   * Seed de configuraciones de eventos si no existen
   */
  async seedEventConfigs(): Promise<void> {
    for (const seed of EVENT_SEEDS) {
      const existing = await this.configRepository.findOne({
        where: { eventType: seed.eventType },
      });

      if (!existing) {
        await this.configRepository.save(this.configRepository.create(seed));
        this.logger.log(`Evento creado: ${seed.eventType}`);
      }
    }
    this.logger.log('Seed de eventos de notificacion completado');
  }

  /**
   * Refrescar cache de configuraciones
   */
  async refreshCache(): Promise<void> {
    const configs = await this.configRepository.find();
    this.configCache.clear();
    for (const config of configs) {
      this.configCache.set(config.eventType, config.isEnabled);
    }
  }

  /**
   * Verificar si un evento está habilitado (usa cache)
   */
  isEventEnabled(eventType: string): boolean {
    return this.configCache.get(eventType) ?? true;
  }

  /**
   * Obtener todas las configuraciones
   */
  async findAll(): Promise<NotificationEventConfig[]> {
    return this.configRepository.find({ order: { category: 'ASC', eventType: 'ASC' } });
  }

  /**
   * Actualizar configuración de un evento
   */
  async update(id: string, dto: UpdateEventConfigDto): Promise<NotificationEventConfig> {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new Error('Configuracion de evento no encontrada');
    }

    config.isEnabled = dto.isEnabled;
    const updated = await this.configRepository.save(config);

    // Refrescar cache
    this.configCache.set(config.eventType, dto.isEnabled);

    this.logger.log(`Evento ${config.eventType} ${dto.isEnabled ? 'habilitado' : 'deshabilitado'}`);
    return updated;
  }
}
