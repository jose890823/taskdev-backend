import { Injectable, Logger } from '@nestjs/common';
import { ModuleLoaderService } from './shared/module-loader.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly startTime = Date.now();

  constructor(private readonly moduleLoaderService: ModuleLoaderService) {}

  getHello(): string {
    return 'Hello World! 🚀 Arquitectura Modular NestJS';
  }

  getHealthStatus() {
    const uptime = Date.now() - this.startTime;
    const loadedModules = this.moduleLoaderService.getAllLoadedModules();

    const modulesStatus = loadedModules.reduce(
      (acc, moduleInfo) => {
        acc[moduleInfo.name] = moduleInfo.loaded ? 'loaded' : 'error';
        return acc;
      },
      {} as Record<string, string>,
    );

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime / 1000), // en segundos
      version: '1.0.0',
      modules: modulesStatus,
      totalModules: loadedModules.length,
      loadedModules: loadedModules.filter((m) => m.loaded).length,
    };
  }
}
