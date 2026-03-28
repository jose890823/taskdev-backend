import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { existsSync } from 'fs';
import { join } from 'path';
import { Invitation } from './entities/invitation.entity';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProjectsModule } from '../projects/projects.module';
import { User } from '../auth/entities/user.entity';

// Importacion condicional del EmailModule y EmailService

let EmailModule: any = null;

let EmailService: any = null;
const emailModulePath = join(__dirname, '../email/email.module');
if (
  existsSync(emailModulePath + '.ts') ||
  existsSync(emailModulePath + '.js')
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- conditional require for optional module
    EmailModule = require('../email/email.module').EmailModule;
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- conditional require for optional module
    EmailService = require('../email/email.service').EmailService;
  } catch {
    // EmailModule no disponible
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([Invitation, User]),
    OrganizationsModule,
    ProjectsModule,
    ConfigModule,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- spreading optional dynamic module
    ...(EmailModule ? [EmailModule] : []),
  ],
  controllers: [InvitationsController],
  providers: [
    InvitationsService,
    ...(EmailService
      ? [
          {
            provide: 'EmailService',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- EmailService is a dynamic require result; type-safe at runtime
            useExisting: EmailService,
          },
        ]
      : []),
  ],
  exports: [InvitationsService],
})
export class InvitationsModule {}
