# CLAUDE.md - Backend TaskHub

Este archivo define las reglas, patrones y convenciones que Claude debe seguir al trabajar con este proyecto backend NestJS.

## Comandos de Desarrollo

```bash
pnpm install                 # Instalar dependencias
pnpm run start:dev           # Modo desarrollo con watch
pnpm run build               # Build de produccion
pnpm run test                # Tests unitarios
pnpm run test:watch          # Tests en modo watch
pnpm run test -- --testPathPattern=auth   # Tests de modulo especifico
pnpm run lint                # ESLint con auto-fix
pnpm run test:e2e            # Tests end-to-end
```

**Swagger:** `http://localhost:3001/api/docs`

---

## Arquitectura del Proyecto

### Estructura de Carpetas

```
src/
├── app.module.ts             # Modulo raiz (Global)
├── main.ts                   # Entry point con Swagger y configuracion global
├── common/                   # Elementos transversales
│   ├── dto/                  # DTOs de respuesta estandar
│   ├── filters/              # Filtros de excepcion (HttpExceptionFilter)
│   ├── guards/               # Guards globales (organization.guard.ts)
│   ├── interceptors/         # ResponseInterceptor
│   └── utils/                # Utilidades (date-formatter, text-normalizer)
├── shared/                   # Configuracion global
│   ├── database.module.ts    # TypeORM setup
│   ├── seeder.module.ts      # Datos iniciales (super admin + task statuses)
│   └── encryption.service.ts # Servicios compartidos
├── modules/                  # Modulos de funcionalidad (feature-based)
│   ├── auth/                 # JWT, OTP, gestion de passwords
│   ├── users/                # Gestion de usuarios y perfiles
│   ├── email/                # Servicio de email (Resend + Gmail)
│   ├── storage/              # Almacenamiento modular (Local, S3, GCS, Cloudinary)
│   ├── security/             # Rate limiting, sesiones, actividad, audit logs
│   ├── notifications/        # Notificaciones in-app, push, preferencias
│   ├── cache/                # Redis cache con decoradores
│   ├── jobs/                 # Bull queue para background jobs
│   ├── i18n/                 # Traducciones en BD (es/en)
│   ├── webhooks/             # Webhook resilience, reintentos
│   ├── feature-flags/        # Feature flags con guard y decorator
│   ├── organizations/        # Organizaciones + miembros (multi-org)
│   ├── invitations/          # Invitaciones por email con token
│   ├── projects/             # Proyectos + miembros (org o personal)
│   ├── project-modules/      # Modulos de proyecto (agrupacion)
│   ├── task-statuses/        # Estados de tarea (por proyecto o globales)
│   ├── tasks/                # Tareas (project + daily), subtareas recursivas
│   ├── comments/             # Comentarios en tareas
│   └── activity/             # Registro de actividad (logs)
└── migrations/               # Migraciones de BD
```

### Organizacion Modular

- **Feature-based**: Cada modulo es auto-contenido con su estructura completa
- **Separation of Concerns**: Controllers, Services, Entities, DTOs bien separados
- **Controllers separados por rol**: `users.controller.ts` (publico) y `users-admin.controller.ts` (admin)

---

## Convenciones de Naming

### Archivos

| Tipo | Patron | Ejemplo |
|------|--------|---------|
| Controller | `{entidad}.controller.ts` | `auth.controller.ts` |
| Controller Admin | `{entidad}-admin.controller.ts` | `users-admin.controller.ts` |
| Service | `{entidad}.service.ts` | `users.service.ts` |
| Service especializado | `{entidad}-{dominio}.service.ts` | `user-activity.service.ts` |
| Entity | `{entidad}.entity.ts` | `user.entity.ts` |
| DTO | `{entidad}-{accion}.dto.ts` o `{accion}.dto.ts` | `create-user.dto.ts`, `login.dto.ts` |
| Module | `{entidad}.module.ts` | `auth.module.ts` |
| Guard | `{nombre}.guard.ts` | `jwt-auth.guard.ts` |
| Strategy | `{nombre}.strategy.ts` | `jwt.strategy.ts` |
| Decorator | `{nombre}.decorator.ts` | `public.decorator.ts` |
| Filter | `{nombre}.filter.ts` | `http-exception.filter.ts` |
| Interceptor | `{nombre}.interceptor.ts` | `response.interceptor.ts` |
| Test | `{archivo}.spec.ts` | `auth.service.spec.ts` |
| Utilidad | `{nombre}.util.ts` | `date-formatter.util.ts` |

### Clases y Tipos

```typescript
// Controllers - PascalCase con sufijo Controller
export class AuthController {}
export class UsersAdminController {}

// Services - PascalCase con sufijo Service
export class UsersService {}
export class UserActivityService {}

// Entities - PascalCase singular
export class User {}
export class Organization {}

// DTOs - PascalCase con sufijo Dto
export class RegisterDto {}
export class CreateTaskDto {}

// Guards - PascalCase con sufijo Guard
export class JwtAuthGuard {}
export class RolesGuard {}

// Enums - PascalCase, valores en UPPER_SNAKE_CASE
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  USER = 'user',
}
```

### Variables y Metodos

```typescript
// Variables - camelCase
const userRepository: Repository<User>
const jwtService: JwtService

// Constantes - UPPER_SNAKE_CASE
const MAX_OTP_ATTEMPTS = 3

// Booleanas con prefijo 'is', 'has', 'can'
const isPublic: boolean
const hasAccess: boolean

// Metodos CRUD en Services
async findAll(): Promise<Entity[]>
async findById(id: string): Promise<Entity>
async create(dto: CreateDto): Promise<Entity>
async update(id: string, dto: UpdateDto): Promise<Entity>
async delete(id: string): Promise<void>

// Metodos privados/helpers
private async hashPassword(password: string): Promise<string>
private generateOtp(): string
private toResponseDto(entity: Entity): ResponseDto
```

---

## Patrones de Codigo

### DTOs con Validaciones

**REGLAS OBLIGATORIAS:**
- Siempre usar `@ApiProperty()` con `example` y `description`
- Mensajes de validacion en espanol
- Usar `@IsNotEmpty()` para campos obligatorios
- Usar `@IsOptional()` para campos opcionales
- Crear archivo `index.ts` en carpeta dto que exporte todos

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    example: 'juan.perez@example.com',
    description: 'Email del usuario (debe ser unico)',
  })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  @IsEmail({}, { message: 'El email debe tener un formato valido' })
  email: string;

  @ApiProperty({
    example: 'P@ssw0rd123!',
    description: 'Contrasena (minimo 8 caracteres)',
    minLength: 8,
  })
  @IsNotEmpty({ message: 'La contrasena es obligatoria' })
  @IsString({ message: 'La contrasena debe ser una cadena de texto' })
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  password: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;
}

// dto/index.ts
export * from './create-user.dto';
export * from './update-user.dto';
```

### Controllers

**REGLAS OBLIGATORIAS:**
- Siempre usar decoradores Swagger (`@ApiTags`, `@ApiOperation`, `@ApiResponse`)
- `@Public()` para rutas sin autenticacion
- `@UseGuards(JwtAuthGuard)` para rutas protegidas
- `@Roles()` con `RolesGuard` para control de acceso por rol
- `@CurrentUser()` para obtener el usuario autenticado

```typescript
@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Obtener todos los usuarios' })
  @ApiResponse({ status: 200, description: 'Lista de usuarios' })
  async findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear un nuevo usuario' })
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: User) {
    return this.usersService.create(dto);
  }
}
```

### Services

**REGLAS OBLIGATORIAS:**
- Logger privado: `private readonly logger = new Logger(ClassName.name)`
- Usar excepciones especificas de NestJS
- Mensajes de error en espanol
- Inyectar repositorios con `@InjectRepository(Entity)`

```typescript
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /** Buscar usuario por ID */
  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }
}
```

### Entities TypeORM

**REGLAS OBLIGATORIAS:**
- `@Entity('nombre_tabla')` con nombre en snake_case plural
- `@PrimaryGeneratedColumn('uuid')` para IDs
- `@Index()` en campos de busqueda frecuente
- `@Exclude()` para campos sensibles (password, tokens, OTP)
- `@CreateDateColumn()`, `@UpdateDateColumn()`, `@DeleteDateColumn()` para timestamps
- Constructor con `Partial<Entity>` para inicializacion

```typescript
@Entity('users')
@Index(['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Exclude()
  @Column({ type: 'varchar', length: 255 })
  password: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}
```

---

## Formato de Respuesta API

Todas las respuestas siguen este formato (aplicado por `ResponseInterceptor`):

```typescript
// Exito
{
  success: true,
  data: { /* payload */ },
  message: "Operacion realizada exitosamente",
  timestamp: "2026-02-06T10:30:00.000Z",
  path: "/api/users"
}

// Error
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Los datos proporcionados no son validos",
    details: { /* detalles adicionales */ }
  },
  timestamp: "2026-02-06T10:30:00.000Z",
  path: "/api/users"
}
```

---

## Decoradores Personalizados

### @Public()
Marca una ruta como publica (sin autenticacion):
```typescript
@Post('register')
@Public()
async register(@Body() dto: RegisterDto) {}
```

### @CurrentUser()
Obtiene el usuario autenticado del request:
```typescript
@Get('profile')
async getProfile(@CurrentUser() user: User) {}
```

### @Roles()
Define los roles permitidos para una ruta:
```typescript
@Delete(':id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
async deleteUser(@Param('id') id: string) {}
```

---

## Manejo de Errores

```typescript
throw new NotFoundException('Usuario no encontrado');
throw new BadRequestException('Datos invalidos');
throw new ConflictException('El email ya esta registrado');
throw new ForbiddenException('No tienes permiso para esta accion');
throw new UnauthorizedException('Credenciales invalidas');
```

---

## Soft Delete Pattern

```typescript
@DeleteDateColumn()
deletedAt: Date | null;

// Busqueda incluyendo eliminados
const user = await this.userRepository.findOne({
  where: { email },
  withDeleted: true,
});

// Soft delete
await this.userRepository.softDelete(id);
```

---

## Configuracion Global (main.ts)

```typescript
app.setGlobalPrefix('api');

app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);

app.enableCors({
  origin: (origin, callback) => { /* logica */ },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
});
```

---

## Base de Datos

- **Motor:** PostgreSQL
- **ORM:** TypeORM
- **BD Dev:** `taskdev_db`
- **Dev:** `synchronize: true` (crea tablas automaticamente)
- **Prod:** `synchronize: false` (usar migraciones)

---

## Variables de Entorno

```bash
NODE_ENV=development

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskdev_db
DB_USERNAME=postgres
DB_PASSWORD=your_password_here

# Server
PORT=3001
APP_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRATION=24h
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRATION=30d

# Email
GMAIL_USER=your_gmail@gmail.com
GMAIL_APP_PASSWORD=your_app_password
EMAIL_FROM=noreply@taskhub.com

# Super Admin
SUPER_ADMIN_EMAIL=admin@taskhub.com
SUPER_ADMIN_PASSWORD=ChangeThisPassword123!
```

Ver archivo `.env.example` para la lista completa.

---

## Autenticacion

- **Access tokens:** JWT con expiracion configurable
- **Refresh tokens:** Rotacion automatica
- **OTP email:** 6 digitos, 10 min expiracion, 3 intentos max
- **Roles:** `user`, `super_admin`

---

## Modelo de Datos TaskHub

**Organizaciones:** Organization → OrganizationMember (owner/admin/member). Invitation con token y expiracion.

**Proyectos:** Project (organizationId nullable = personal) → ProjectMember (owner/admin/member/viewer). ProjectModule para agrupar tareas. TaskStatus por proyecto (+ globales para daily).

**Tareas:** Task con type (project/daily), parentId recursivo para subtareas, statusId, assignedToId, priority, scheduledDate, dueDate, completedAt. Comment para comentarios. ActivityLog para historial.

**Seeder:** Al iniciar, crea super admin + task statuses globales (Por hacer, En progreso, Completado). Al crear proyecto, evento `project.created` crea 4 statuses default.

---

## Checklist para Nuevos Modulos

1. [ ] Crear carpeta en `src/modules/{nombre}/`
2. [ ] Crear entity en `entities/{nombre}.entity.ts`
3. [ ] Crear DTOs en `dto/` (create, update, response)
4. [ ] Crear `dto/index.ts` que exporte todos los DTOs
5. [ ] Crear service en `{nombre}.service.ts`
6. [ ] Crear controller en `{nombre}.controller.ts`
7. [ ] Crear module en `{nombre}.module.ts`
8. [ ] Agregar module a `app.module.ts`
9. [ ] Documentar con Swagger todos los endpoints
10. [ ] Verificar que el modulo aparece en Swagger UI

---

## Do's and Don'ts

### Do's
- **Siempre** usar `@ApiProperty()` con ejemplo y descripcion en DTOs
- **Siempre** usar Logger con `new Logger(ClassName.name)`
- **Siempre** crear archivo `index.ts` en carpeta `dto/`
- **Siempre** tipar las respuestas async con `Promise<T>`
- **Siempre** usar excepciones especificas de NestJS
- **Siempre** usar `@Exclude()` en campos sensibles
- **Siempre** crear indices `@Index()` en campos de busqueda frecuente
- **Siempre** validar datos de entrada con class-validator

### Don'ts
- **NUNCA** exponer entities directamente en respuestas (usar DTOs)
- **NUNCA** guardar passwords en texto plano (usar bcrypt)
- **NUNCA** hardcodear valores de configuracion (usar ConfigService)
- **NUNCA** usar `console.log` en produccion (usar Logger)
- **NUNCA** usar `synchronize: true` en produccion
- **NUNCA** commitear archivos `.env`
- **NUNCA** crear endpoints sin documentacion Swagger
