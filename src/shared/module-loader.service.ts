import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DynamicModule, Type } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface ModuleInfo {
  name: string;
  path: string;
  module: Type<any> | null;
  loaded: boolean;
  error?: string;
}

@Injectable()
export class ModuleLoaderService {
  private readonly logger = new Logger(ModuleLoaderService.name);
  private loadedModules = new Map<string, ModuleInfo>();

  constructor(private moduleRef: ModuleRef) {}

  async loadAvailableModules(): Promise<ModuleInfo[]> {
    const modulesPath = path.join(process.cwd(), 'src', 'modules');

    if (!fs.existsSync(modulesPath)) {
      this.logger.log('Directorio de módulos no existe, creándolo...');
      fs.mkdirSync(modulesPath, { recursive: true });
      return [];
    }

    const moduleDirectories = fs
      .readdirSync(modulesPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    const moduleInfos: ModuleInfo[] = [];

    for (const moduleDir of moduleDirectories) {
      try {
        const moduleInfo = await this.loadModule(moduleDir, modulesPath);
        if (moduleInfo) {
          moduleInfos.push(moduleInfo);
          this.loadedModules.set(moduleDir, moduleInfo);
        }
      } catch (error) {
        this.logger.warn(
          `Error cargando módulo ${moduleDir}: ${error.message}`,
        );
        const failedModuleInfo: ModuleInfo = {
          name: moduleDir,
          path: path.join(modulesPath, moduleDir),
          module: null,
          loaded: false,
          error: error.message,
        };
        moduleInfos.push(failedModuleInfo);
        this.loadedModules.set(moduleDir, failedModuleInfo);
      }
    }

    return moduleInfos;
  }

  private async loadModule(
    moduleDir: string,
    modulesPath: string,
  ): Promise<ModuleInfo | null> {
    const modulePath = path.join(modulesPath, moduleDir);
    const moduleFiles = [
      `${moduleDir}.module.ts`,
      `${moduleDir}.module.js`,
      'index.ts',
      'index.js',
    ];

    let moduleFilePath: string | null = null;

    for (const file of moduleFiles) {
      const fullPath = path.join(modulePath, file);
      if (fs.existsSync(fullPath)) {
        moduleFilePath = fullPath;
        break;
      }
    }

    if (!moduleFilePath) {
      throw new Error(
        `No se encontró archivo de módulo válido en ${modulePath}`,
      );
    }

    try {
      const moduleExport = await import(moduleFilePath);
      const ModuleClass =
        moduleExport.default ||
        moduleExport[`${this.capitalize(moduleDir)}Module`] ||
        Object.values(moduleExport).find(
          (exp) =>
            typeof exp === 'function' &&
            exp.name &&
            exp.name.includes('Module'),
        );

      if (!ModuleClass) {
        throw new Error(
          `No se encontró clase de módulo válida en ${moduleFilePath}`,
        );
      }

      return {
        name: moduleDir,
        path: modulePath,
        module: ModuleClass as Type<any>,
        loaded: true,
      };
    } catch (error) {
      throw new Error(`Error importando módulo: ${error.message}`);
    }
  }

  getLoadedModule(name: string): ModuleInfo | undefined {
    return this.loadedModules.get(name);
  }

  getAllLoadedModules(): ModuleInfo[] {
    return Array.from(this.loadedModules.values());
  }

  isModuleLoaded(name: string): boolean {
    const moduleInfo = this.loadedModules.get(name);
    return moduleInfo?.loaded === true;
  }

  async getService<T>(
    moduleName: string,
    serviceToken: string | Type<T>,
  ): Promise<T | null> {
    const moduleInfo = this.getLoadedModule(moduleName);

    if (!moduleInfo?.loaded) {
      this.logger.warn(`Módulo ${moduleName} no está cargado, retornando null`);
      return null;
    }

    try {
      return this.moduleRef.get(serviceToken, { strict: false });
    } catch (error) {
      this.logger.warn(
        `Servicio ${serviceToken.toString()} no encontrado en módulo ${moduleName}: ${error.message}`,
      );
      return null;
    }
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
