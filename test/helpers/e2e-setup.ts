/**
 * E2E Test Setup Helper
 *
 * Provides utilities for creating the NestJS app, authenticating users,
 * and cleaning up test data between tests.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';

// ─── Types ───────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

export interface AuthenticatedUser {
  user: TestUser;
  tokens: AuthTokens;
}

// ─── App Setup ───────────────────────────────────────────────────

let cachedApp: INestApplication | null = null;
let cachedDataSource: DataSource | null = null;

/**
 * Creates and configures the NestJS application for E2E testing.
 * Reuses the same app instance across calls within a test suite.
 */
export async function createE2EApp(): Promise<INestApplication> {
  if (cachedApp) return cachedApp;

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  // Replicate main.ts configuration
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  cachedApp = app;
  cachedDataSource = moduleFixture.get<DataSource>(DataSource);

  return app;
}

/**
 * Gets the HTTP server from the app for supertest
 */
export function getServer(app: INestApplication): import('http').Server {
  return app.getHttpServer() as import('http').Server;
}

/**
 * Closes the app and cleans up connections
 */
export async function closeE2EApp(): Promise<void> {
  if (cachedApp) {
    await cachedApp.close();
    cachedApp = null;
    cachedDataSource = null;
  }
}

/**
 * Gets the DataSource for direct DB queries (cleanup, verification)
 */
export function getDataSource(): DataSource {
  if (!cachedDataSource) {
    throw new Error('DataSource not available — call createE2EApp() first');
  }
  return cachedDataSource;
}

// ─── Auth Helpers ────────────────────────────────────────────────

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@taskhub.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'Admin123!';

/**
 * Logs in as the seeded super admin and returns tokens.
 */
export async function loginAsSuperAdmin(
  app: INestApplication,
): Promise<AuthenticatedUser> {
  const server = getServer(app);

  // Clear rate-limit records so login doesn't get blocked
  await clearSecurityRecords();

  const res = await request(server)
    .post('/api/auth/login')
    .send({ email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASSWORD })
    .expect(200);

  const body = res.body as {
    data: {
      accessToken: string;
      refreshToken: string;
      user: TestUser;
    };
  };

  return {
    user: body.data.user,
    tokens: {
      accessToken: body.data.accessToken,
      refreshToken: body.data.refreshToken,
    },
  };
}

/** Counter for unique test user emails */
let userCounter = 0;

/**
 * Registers a fresh test user with a unique email.
 * Verifies the email directly in the DB (bypasses OTP flow).
 * Returns the authenticated user with tokens.
 */
export async function createTestUser(
  app: INestApplication,
  overrides: Partial<{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
  }> = {},
): Promise<AuthenticatedUser> {
  const server = getServer(app);
  userCounter++;
  const timestamp = Date.now();

  const email =
    overrides.email || `e2e-test-${timestamp}-${userCounter}@test.com`;
  const password = overrides.password || 'TestPass123!';

  // Clear rate-limit records so user creation doesn't get blocked
  await clearSecurityRecords();

  // Register
  await request(server)
    .post('/api/auth/register')
    .send({
      email,
      password,
      firstName: overrides.firstName || `Test${userCounter}`,
      lastName: overrides.lastName || 'User',
      phone: overrides.phone || `+1${String(timestamp).slice(-10)}`,
    })
    .expect(201);

  // Verify email directly in DB (bypass OTP)
  const ds = getDataSource();
  await ds.query(`UPDATE users SET "emailVerified" = true WHERE email = $1`, [
    email,
  ]);

  // Login
  const loginRes = await request(server)
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);

  const body = loginRes.body as {
    data: {
      accessToken: string;
      refreshToken: string;
      user: TestUser;
    };
  };

  return {
    user: body.data.user,
    tokens: {
      accessToken: body.data.accessToken,
      refreshToken: body.data.refreshToken,
    },
  };
}

// ─── Cleanup ─────────────────────────────────────────────────────

/**
 * Cleans up ALL test data created during E2E tests.
 * Preserves the seeded super admin and global task statuses.
 * Order respects FK constraints.
 */
export async function cleanupTestData(): Promise<void> {
  const ds = getDataSource();

  // Delete in FK-safe order (children first)
  // Security tables (prevent rate-limit blocking between tests)
  await ds.query(`DELETE FROM login_attempts`);
  await ds.query(`DELETE FROM blocked_ips`);
  await ds.query(`DELETE FROM rate_limit_logs`);
  await ds.query(`DELETE FROM security_events`);
  await ds.query(`DELETE FROM security_alerts`);
  // Domain tables
  await ds.query(`DELETE FROM activity_logs`);
  await ds.query(`DELETE FROM task_comment_reads`);
  await ds.query(`DELETE FROM comments`);
  await ds.query(`DELETE FROM task_assignees`);
  await ds.query(`DELETE FROM tasks`);
  await ds.query(`DELETE FROM task_statuses WHERE "projectId" IS NOT NULL`);
  await ds.query(`DELETE FROM project_modules`);
  await ds.query(`DELETE FROM project_members`);
  await ds.query(`DELETE FROM invitations`);
  await ds.query(`DELETE FROM projects`);
  await ds.query(`DELETE FROM organization_members`);
  await ds.query(`DELETE FROM organizations`);
  await ds.query(`DELETE FROM notifications WHERE "userId" IN (SELECT id FROM users WHERE "isSystemUser" = false AND email LIKE '%@test.com')`);
  await ds.query(`DELETE FROM active_sessions WHERE "userId" IN (SELECT id FROM users WHERE "isSystemUser" = false AND email LIKE '%@test.com')`);
  await ds.query(`DELETE FROM user_activities WHERE "userId" IN (SELECT id FROM users WHERE "isSystemUser" = false AND email LIKE '%@test.com')`);
  // Delete test users (preserve super admin and system users)
  await ds.query(
    `DELETE FROM users WHERE "isSystemUser" = false AND email LIKE '%@test.com'`,
  );
}

/**
 * Clears rate-limit / login-attempt records so tests don't interfere.
 * Call this inside beforeEach or before a block of login-failure tests.
 */
export async function clearSecurityRecords(): Promise<void> {
  const ds = getDataSource();
  await ds.query(`DELETE FROM login_attempts`);
  await ds.query(`DELETE FROM blocked_ips`);
  await ds.query(`DELETE FROM rate_limit_logs`);
}

// ─── Request Helpers ─────────────────────────────────────────────

/**
 * Creates an authenticated supertest agent with Bearer token.
 */
export function authGet(
  app: INestApplication,
  path: string,
  token: string,
): request.Test {
  return request(getServer(app))
    .get(path)
    .set('Authorization', `Bearer ${token}`);
}

export function authPost(
  app: INestApplication,
  path: string,
  token: string,
): request.Test {
  return request(getServer(app))
    .post(path)
    .set('Authorization', `Bearer ${token}`);
}

export function authPatch(
  app: INestApplication,
  path: string,
  token: string,
): request.Test {
  return request(getServer(app))
    .patch(path)
    .set('Authorization', `Bearer ${token}`);
}

export function authDelete(
  app: INestApplication,
  path: string,
  token: string,
): request.Test {
  return request(getServer(app))
    .delete(path)
    .set('Authorization', `Bearer ${token}`);
}

export function authPut(
  app: INestApplication,
  path: string,
  token: string,
): request.Test {
  return request(getServer(app))
    .put(path)
    .set('Authorization', `Bearer ${token}`);
}
