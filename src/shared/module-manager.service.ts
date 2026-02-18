import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export interface ModuleInfo {
  name: string;
  path: string;
  exists: boolean;
  enabled: boolean;
  description?: string;
  lastChecked: Date;
}

/**
 * ModuleManagerService
 *
 * Servicio central para gestionar la disponibilidad y estado de módulos opcionales.
 * Permite que el sistema funcione sin módulos específicos sin romperse.
 *
 * Filosofía: "Si elimino un módulo, el sistema sigue funcionando"
 */
@Injectable()
export class ModuleManagerService implements OnModuleInit {
  private readonly logger = new Logger(ModuleManagerService.name);
  private modules: Map<string, ModuleInfo> = new Map();
  private readonly modulesPath = join(process.cwd(), 'src', 'modules');

  onModuleInit() {
    this.scanModules();
    this.logger.log('🔍 ModuleManager inicializado');
    this.logModuleStatus();
  }

  /**
   * Escanea el directorio de módulos para detectar qué módulos existen
   */
  private scanModules(): void {
    if (!existsSync(this.modulesPath)) {
      this.logger.warn('⚠️  Directorio de módulos no encontrado');
      return;
    }

    try {
      const dirs = readdirSync(this.modulesPath);

      dirs.forEach((dir) => {
        const modulePath = join(this.modulesPath, dir);
        const stat = statSync(modulePath);

        if (stat.isDirectory()) {
          const moduleFile = join(modulePath, `${dir}.module.ts`);
          const serviceFile = join(modulePath, `${dir}.service.ts`);

          const exists = existsSync(moduleFile) || existsSync(serviceFile);

          this.modules.set(dir, {
            name: dir,
            path: modulePath,
            exists,
            enabled: exists, // Por defecto, si existe está habilitado
            lastChecked: new Date(),
          });
        }
      });
    } catch (error) {
      this.logger.error('Error escaneando módulos:', error.message);
    }
  }

  /**
   * Verifica si un módulo existe y está habilitado
   */
  isModuleAvailable(moduleName: string): boolean {
    const module = this.modules.get(moduleName);
    return module ? module.exists && module.enabled : false;
  }

  /**
   * Obtiene información de un módulo
   */
  getModuleInfo(moduleName: string): ModuleInfo | undefined {
    return this.modules.get(moduleName);
  }

  /**
   * Obtiene lista de todos los módulos
   */
  getAllModules(): ModuleInfo[] {
    return Array.from(this.modules.values());
  }

  /**
   * Obtiene solo módulos disponibles
   */
  getAvailableModules(): ModuleInfo[] {
    return this.getAllModules().filter((m) => m.exists && m.enabled);
  }

  /**
   * Habilita un módulo (si existe)
   */
  enableModule(moduleName: string): boolean {
    const module = this.modules.get(moduleName);
    if (module && module.exists) {
      module.enabled = true;
      this.logger.log(`✅ Módulo '${moduleName}' habilitado`);
      return true;
    }
    this.logger.warn(`⚠️  No se puede habilitar '${moduleName}' - no existe`);
    return false;
  }

  /**
   * Deshabilita un módulo
   */
  disableModule(moduleName: string): boolean {
    const module = this.modules.get(moduleName);
    if (module) {
      module.enabled = false;
      this.logger.log(`🚫 Módulo '${moduleName}' deshabilitado`);
      return true;
    }
    return false;
  }

  /**
   * Re-escanea los módulos (útil para detectar cambios en tiempo real)
   */
  refresh(): void {
    this.logger.log('🔄 Re-escaneando módulos...');
    this.modules.clear();
    this.scanModules();
    this.logModuleStatus();
  }

  /**
   * Registra el estado de los módulos en los logs
   */
  private logModuleStatus(): void {
    const available = this.getAvailableModules();
    const unavailable = this.getAllModules().filter(
      (m) => !m.exists || !m.enabled,
    );

    this.logger.log(`📦 Módulos disponibles: ${available.length}`);
    available.forEach((m) => {
      this.logger.log(`  ✅ ${m.name}`);
    });

    if (unavailable.length > 0) {
      this.logger.log(`📦 Módulos no disponibles: ${unavailable.length}`);
      unavailable.forEach((m) => {
        const reason = !m.exists ? 'no existe' : 'deshabilitado';
        this.logger.log(`  ⚪ ${m.name} (${reason})`);
      });
    }
  }

  /**
   * Helper para ejecutar código solo si un módulo está disponible
   */
  async executeIfModuleAvailable<T>(
    moduleName: string,
    callback: () => Promise<T>,
    fallback?: () => Promise<T>,
  ): Promise<T | null> {
    if (this.isModuleAvailable(moduleName)) {
      try {
        return await callback();
      } catch (error) {
        this.logger.error(
          `Error ejecutando función del módulo '${moduleName}':`,
          error.message,
        );
        return fallback ? await fallback() : null;
      }
    } else {
      this.logger.debug(
        `Módulo '${moduleName}' no disponible, usando fallback`,
      );
      return fallback ? await fallback() : null;
    }
  }
}
