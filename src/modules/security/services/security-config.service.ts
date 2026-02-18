import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityConfig } from '../entities/security-config.entity';

interface DefaultConfig {
  key: string;
  value: string;
  valueType: 'string' | 'number' | 'boolean' | 'json';
  description: string;
  category: string;
}

@Injectable()
export class SecurityConfigService implements OnModuleInit {
  private readonly logger = new Logger(SecurityConfigService.name);
  private configCache: Map<string, SecurityConfig> = new Map();

  private readonly DEFAULT_CONFIGS: DefaultConfig[] = [
    // Rate Limiting
    {
      key: 'rate_limit_login',
      value: '5',
      valueType: 'number',
      description: 'Intentos de login permitidos por minuto por IP',
      category: 'rate_limiting',
    },
    {
      key: 'rate_limit_api',
      value: '100',
      valueType: 'number',
      description: 'Peticiones API por minuto para usuarios no autenticados',
      category: 'rate_limiting',
    },
    {
      key: 'rate_limit_api_authenticated',
      value: '200',
      valueType: 'number',
      description: 'Peticiones API por minuto para usuarios autenticados',
      category: 'rate_limiting',
    },

    // Auto-bloqueo
    {
      key: 'auto_block_after_failed_logins',
      value: '10',
      valueType: 'number',
      description:
        'Bloquear IP automaticamente despues de X intentos de login fallidos',
      category: 'blocking',
    },
    {
      key: 'block_duration_minutes',
      value: '30',
      valueType: 'number',
      description: 'Duracion del bloqueo automatico en minutos',
      category: 'blocking',
    },

    // Sesiones
    {
      key: 'session_max_age_days',
      value: '7',
      valueType: 'number',
      description: 'Duracion maxima de una sesion en dias',
      category: 'sessions',
    },
    {
      key: 'max_sessions_per_user',
      value: '5',
      valueType: 'number',
      description: 'Numero maximo de sesiones activas por usuario',
      category: 'sessions',
    },

    // Verificacion
    {
      key: 'require_email_verification',
      value: 'true',
      valueType: 'boolean',
      description: 'Requerir verificacion de email para login',
      category: 'verification',
    },

    // CORS
    {
      key: 'allowed_cors_origins',
      value: '["http://localhost:3000", "http://localhost:3002"]',
      valueType: 'json',
      description: 'Origenes CORS permitidos (JSON array)',
      category: 'cors',
    },

    // Alertas
    {
      key: 'alert_threshold_failed_logins',
      value: '5',
      valueType: 'number',
      description: 'Numero de logins fallidos para generar alerta',
      category: 'alerts',
    },
    {
      key: 'alert_threshold_rate_limit',
      value: '10',
      valueType: 'number',
      description: 'Numero de rate limits excedidos para generar alerta',
      category: 'alerts',
    },
  ];

  constructor(
    @InjectRepository(SecurityConfig)
    private readonly securityConfigRepository: Repository<SecurityConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultConfigs();
    await this.refreshCache();
  }

  /**
   * Crear configuraciones por defecto si no existen
   */
  private async seedDefaultConfigs(): Promise<void> {
    for (const config of this.DEFAULT_CONFIGS) {
      const existing = await this.securityConfigRepository.findOne({
        where: { key: config.key },
      });

      if (!existing) {
        await this.securityConfigRepository.save(
          this.securityConfigRepository.create(config),
        );
        this.logger.log(`Configuracion de seguridad creada: ${config.key}`);
      }
    }
  }

  /**
   * Refrescar cache de configuraciones
   */
  async refreshCache(): Promise<void> {
    const configs = await this.securityConfigRepository.find();
    this.configCache.clear();
    configs.forEach((config) => {
      this.configCache.set(config.key, config);
    });
    this.logger.debug(
      `Cache de configuraciones actualizado: ${this.configCache.size} configs`,
    );
  }

  /**
   * Obtener valor de configuracion como string
   */
  async getValue(key: string, defaultValue: string = ''): Promise<string> {
    // Intentar desde cache primero
    let config: SecurityConfig | null | undefined = this.configCache.get(key);

    if (!config) {
      const found = await this.securityConfigRepository.findOne({
        where: { key },
      });
      if (found) {
        this.configCache.set(key, found);
        config = found;
      }
    }

    return config?.value || defaultValue;
  }

  /**
   * Obtener valor como numero
   */
  async getNumberValue(key: string, defaultValue: number = 0): Promise<number> {
    const value = await this.getValue(key, String(defaultValue));
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Obtener valor como booleano
   */
  async getBooleanValue(
    key: string,
    defaultValue: boolean = false,
  ): Promise<boolean> {
    const value = await this.getValue(key, String(defaultValue));
    return value === 'true';
  }

  /**
   * Obtener valor como JSON
   */
  async getJsonValue<T>(key: string, defaultValue: T): Promise<T> {
    const value = await this.getValue(key, '');
    if (!value) return defaultValue;

    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Actualizar valor de configuracion
   */
  async updateValue(
    key: string,
    value: string,
    updatedById?: string,
  ): Promise<SecurityConfig | null> {
    const config = await this.securityConfigRepository.findOne({
      where: { key },
    });
    if (!config) return null;

    config.value = value;
    config.updatedById = updatedById || null;
    config.updatedAt = new Date();

    const saved = await this.securityConfigRepository.save(config);
    this.configCache.set(key, saved);

    this.logger.log(`Configuracion actualizada: ${key} = ${value}`);
    return saved;
  }

  /**
   * Obtener todas las configuraciones
   */
  async findAll(): Promise<SecurityConfig[]> {
    return this.securityConfigRepository.find({
      relations: ['updatedBy'],
      order: { category: 'ASC', key: 'ASC' },
    });
  }

  /**
   * Obtener configuraciones por categoria
   */
  async findByCategory(category: string): Promise<SecurityConfig[]> {
    return this.securityConfigRepository.find({
      where: { category },
      relations: ['updatedBy'],
      order: { key: 'ASC' },
    });
  }

  /**
   * Crear nueva configuracion
   */
  async create(
    key: string,
    value: string,
    valueType: 'string' | 'number' | 'boolean' | 'json',
    description: string,
    category: string,
    createdById?: string,
  ): Promise<SecurityConfig> {
    const config = this.securityConfigRepository.create({
      key,
      value,
      valueType,
      description,
      category,
      updatedById: createdById,
    });

    const saved = await this.securityConfigRepository.save(config);
    this.configCache.set(key, saved);

    this.logger.log(`Nueva configuracion creada: ${key}`);
    return saved;
  }
}
