import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../auth/entities/user.entity';

/**
 * Configuraciones de seguridad ajustables
 *
 * Keys disponibles:
 * - rate_limit_login: Intentos de login por minuto (default: 5)
 * - rate_limit_api: Peticiones API por minuto (default: 100)
 * - rate_limit_api_authenticated: Peticiones API por minuto para usuarios autenticados (default: 200)
 * - auto_block_after_failed_logins: Bloquear IP despues de X fallos (default: 10)
 * - block_duration_minutes: Duracion del bloqueo automatico (default: 30)
 * - session_max_age_days: Duracion maxima de sesion (default: 7)
 * - max_sessions_per_user: Sesiones maximas por usuario (default: 5)
 * - require_email_verification: Requerir verificacion de email (default: true)
 * - allowed_cors_origins: Origenes CORS permitidos (default: localhost)
 */
@Entity('security_configs')
@Index(['key'], { unique: true })
export class SecurityConfig {
  @ApiProperty({ description: 'ID unico de la configuracion' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Clave de la configuracion' })
  @Column({ type: 'varchar', length: 100 })
  key: string;

  @ApiProperty({ description: 'Valor de la configuracion' })
  @Column({ type: 'text' })
  value: string;

  @ApiProperty({ description: 'Tipo de dato del valor' })
  @Column({ type: 'varchar', length: 20, default: 'string' })
  valueType: 'string' | 'number' | 'boolean' | 'json';

  @ApiProperty({ description: 'Descripcion de la configuracion' })
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({ description: 'Categoria de la configuracion' })
  @Column({ type: 'varchar', length: 50, default: 'general' })
  category: string;

  @UpdateDateColumn()
  updatedAt: Date;

  @ApiProperty({ description: 'ID del admin que actualizo' })
  @Column({ type: 'uuid', nullable: true })
  updatedById: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updatedById' })
  updatedBy: User | null;

  constructor(partial: Partial<SecurityConfig>) {
    Object.assign(this, partial);
  }

  /**
   * Obtiene el valor parseado segun su tipo
   */
  getParsedValue(): string | number | boolean | Record<string, any> {
    switch (this.valueType) {
      case 'number':
        return parseFloat(this.value);
      case 'boolean':
        return this.value === 'true';
      case 'json':
        try {
          return JSON.parse(this.value);
        } catch {
          return {};
        }
      default:
        return this.value;
    }
  }
}
