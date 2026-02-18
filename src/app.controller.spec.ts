import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ModuleLoaderService } from './shared/module-loader.service';

describe('AppController', () => {
  let appController: AppController;

  const mockModuleLoaderService = {
    getAllLoadedModules: jest.fn().mockReturnValue([]),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ModuleLoaderService,
          useValue: mockModuleLoaderService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return app info message', () => {
      expect(appController.getHello()).toContain('Hello World');
    });
  });
});
