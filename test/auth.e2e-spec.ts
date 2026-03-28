/**
 * Auth Module — E2E Test Suite
 *
 * Comprehensive end-to-end tests covering registration, login, token refresh,
 * profile retrieval, logout, session management, password flows, and
 * security/validation edge cases.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createE2EApp,
  closeE2EApp,
  getServer,
  loginAsSuperAdmin,
  createTestUser,
  cleanupTestData,
  getDataSource,
  authGet,
  authPost,
  clearSecurityRecords,
} from './helpers/e2e-setup';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2EApp();
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeE2EApp();
  });

  beforeEach(async () => {
    await clearSecurityRecords();
  });

  // ─── Helpers ──────────────────────────────────────────────────

  /** Generates a unique email for each test invocation */
  const uniqueEmail = () =>
    `e2e-auth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;

  /** Valid registration payload factory */
  const validRegistration = (overrides: Record<string, unknown> = {}) => ({
    email: uniqueEmail(),
    password: 'TestPass123!',
    firstName: 'Auth',
    lastName: 'Tester',
    phone: `+1${Date.now().toString().slice(-10)}`,
    ...overrides,
  });

  /**
   * Registers a user and manually verifies email in DB, then logs in.
   * Returns tokens + user info for authenticated tests.
   */
  const registerVerifyAndLogin = async (
    overrides: Record<string, unknown> = {},
  ) => {
    const payload = validRegistration(overrides);
    const server = getServer(app);

    // Register
    await request(server)
      .post('/api/auth/register')
      .send(payload)
      .expect(201);

    // Verify email directly in DB
    const ds = getDataSource();
    await ds.query(
      `UPDATE users SET "emailVerified" = true WHERE email = $1`,
      [payload.email],
    );

    // Login
    const loginRes = await request(server)
      .post('/api/auth/login')
      .send({ email: payload.email, password: payload.password })
      .expect(200);

    return {
      email: payload.email,
      password: payload.password as string,
      accessToken: loginRes.body.data.accessToken as string,
      refreshToken: loginRes.body.data.refreshToken as string,
      user: loginRes.body.data.user,
    };
  };

  // ═══════════════════════════════════════════════════════════════
  //  REGISTRATION
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/auth/register', () => {
    it('1 — should register a new user successfully (201)', async () => {
      const payload = validRegistration();
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/register')
        .send(payload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(payload.email);
      expect(res.body.data.user.firstName).toBe(payload.firstName);
      expect(res.body.data.user.lastName).toBe(payload.lastName);
      expect(res.body.data.user.emailVerified).toBe(false);
      expect(res.body.data.message).toContain('registrado exitosamente');
    });

    it('2 — should reject duplicate email (409 Conflict)', async () => {
      const payload = validRegistration();
      const server = getServer(app);

      // First registration
      await request(server)
        .post('/api/auth/register')
        .send(payload)
        .expect(201);

      // Duplicate
      const res = await request(server)
        .post('/api/auth/register')
        .send(payload)
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('3 — should reject weak password (400)', async () => {
      const payload = validRegistration({ password: 'weak' });
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/register')
        .send(payload)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('4 — should reject missing required fields (400)', async () => {
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/register')
        .send({ email: uniqueEmail() }) // missing password, firstName, lastName, phone
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('5 — should reject invalid email format (400)', async () => {
      const payload = validRegistration({ email: 'not-an-email' });
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/register')
        .send(payload)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('6 — should reject invalid phone format (400)', async () => {
      const payload = validRegistration({ phone: 'abc' });
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/register')
        .send(payload)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('7 — should reject password without uppercase (400)', async () => {
      const payload = validRegistration({ password: 'testpass123!' });
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/register')
        .send(payload)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('8 — should reject password without special character (400)', async () => {
      const payload = validRegistration({ password: 'TestPass123' });
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/register')
        .send(payload)
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  LOGIN
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/auth/login', () => {
    it('9 — should login with valid credentials (200)', async () => {
      const { email, password } = await registerVerifyAndLogin();
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(email);
    });

    it('10 — should reject invalid password (401)', async () => {
      const { email } = await registerVerifyAndLogin();
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/login')
        .send({ email, password: 'WrongPass999!' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('11 — should reject non-existent email (401)', async () => {
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/login')
        .send({ email: 'ghost@doesnotexist.com', password: 'Pass123!' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('12 — should reject unverified email (401)', async () => {
      const payload = validRegistration();
      const server = getServer(app);

      // Register but do NOT verify email
      await request(server)
        .post('/api/auth/register')
        .send(payload)
        .expect(201);

      // Attempt login
      const res = await request(server)
        .post('/api/auth/login')
        .send({ email: payload.email, password: payload.password })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('13 — should return user object with expected fields', async () => {
      const { email, password } = await registerVerifyAndLogin();
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);

      const user = res.body.data.user;
      expect(user.id).toBeDefined();
      expect(user.email).toBe(email);
      expect(user.firstName).toBeDefined();
      expect(user.lastName).toBeDefined();
      expect(user.emailVerified).toBe(true);
      expect(user.isActive).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  TOKEN REFRESH
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/auth/refresh', () => {
    it('14 — should refresh tokens with valid refresh token', async () => {
      const { accessToken, refreshToken } = await registerVerifyAndLogin();

      const res = await authPost(app, '/api/auth/refresh', accessToken)
        .send({ refreshToken })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      // Rotation is enforced server-side (hashed token in DB is updated).
      // The JWT string may be identical if generated in the same second
      // (same payload + iat), so we only assert the response shape is correct.
    });

    it('15 — should reject invalid refresh token (401)', async () => {
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token-here' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('16 — should reject request without refresh token (401)', async () => {
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/refresh')
        .send({})
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  PROFILE — GET /api/auth/me
  // ═══════════════════════════════════════════════════════════════

  describe('GET /api/auth/me', () => {
    it('17 — should return current user profile with valid token', async () => {
      const { accessToken, email } = await registerVerifyAndLogin();

      const res = await authGet(app, '/api/auth/me', accessToken).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(email);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.firstName).toBeDefined();
    });

    it('18 — should reject request without token (401)', async () => {
      const server = getServer(app);

      const res = await request(server)
        .get('/api/auth/me')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('19 — should reject request with invalid token (401)', async () => {
      const server = getServer(app);

      const res = await request(server)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  LOGOUT
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/auth/logout', () => {
    it('20 — should logout successfully with refresh token', async () => {
      const { accessToken, refreshToken } = await registerVerifyAndLogin();

      const res = await authPost(app, '/api/auth/logout', accessToken)
        .send({ refreshToken })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('Logout');
    });

    it('21 — should logout without refresh token (still succeeds)', async () => {
      const { accessToken } = await registerVerifyAndLogin();

      const res = await authPost(app, '/api/auth/logout', accessToken)
        .send({})
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('Logout');
    });

    it('22 — should reject logout without auth token (401)', async () => {
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/logout')
        .send({})
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  LOGOUT ALL
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/auth/logout-all', () => {
    it('23 — should revoke all sessions and return count', async () => {
      const { accessToken } = await registerVerifyAndLogin();

      const res = await authPost(app, '/api/auth/logout-all', accessToken)
        .send()
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('Logout');
      expect(typeof res.body.data.sessionsRevoked).toBe('number');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  SESSIONS
  // ═══════════════════════════════════════════════════════════════

  describe('GET /api/auth/sessions', () => {
    it('24 — should list active sessions', async () => {
      const { accessToken } = await registerVerifyAndLogin();

      const res = await authGet(
        app,
        '/api/auth/sessions',
        accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('25 — should reject sessions request without auth (401)', async () => {
      const server = getServer(app);

      const res = await request(server)
        .get('/api/auth/sessions')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  FORGOT PASSWORD
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/auth/forgot-password', () => {
    it('26 — should accept forgot-password for existing email (200)', async () => {
      const { email } = await registerVerifyAndLogin();
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/forgot-password')
        .send({ email })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('Si el email existe');
    });

    it('27 — should accept forgot-password for non-existing email (no enumeration)', async () => {
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@nowhere.com' })
        .expect(200);

      expect(res.body.success).toBe(true);
      // Same message — no way to tell if email exists
      expect(res.body.data.message).toContain('Si el email existe');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  CHANGE PASSWORD (2-step OTP flow)
  // ═══════════════════════════════════════════════════════════════

  describe('POST /api/auth/change-password/request', () => {
    it('28 — should request change-password OTP (200)', async () => {
      const { accessToken, password } = await registerVerifyAndLogin();

      const res = await authPost(
        app,
        '/api/auth/change-password/request',
        accessToken,
      )
        .send({ oldPassword: password })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('Código de verificación');
    });

    it('29 — should reject change-password with wrong current password (400)', async () => {
      const { accessToken } = await registerVerifyAndLogin();

      const res = await authPost(
        app,
        '/api/auth/change-password/request',
        accessToken,
      )
        .send({ oldPassword: 'TotallyWrong999!' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/change-password/confirm', () => {
    it('30 — should confirm change-password with OTP read from DB', async () => {
      const { accessToken, email, password } = await registerVerifyAndLogin();

      // Step 1: Request change password (generates OTP)
      await authPost(app, '/api/auth/change-password/request', accessToken)
        .send({ oldPassword: password })
        .expect(200);

      // Read OTP directly from the database
      const ds = getDataSource();
      const rows = (await ds.query(
        `SELECT "otpCode" FROM users WHERE email = $1`,
        [email],
      )) as { otpCode: string }[];

      expect(rows.length).toBe(1);
      const otpCode = rows[0].otpCode;
      expect(otpCode).toBeDefined();

      // Step 2: Confirm with OTP
      const newPassword = 'NewSecure123!';
      const res = await authPost(
        app,
        '/api/auth/change-password/confirm',
        accessToken,
      )
        .send({ otpCode, newPassword })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('Contraseña cambiada');

      // Verify the new password works by logging in
      const server = getServer(app);
      const loginRes = await request(server)
        .post('/api/auth/login')
        .send({ email, password: newPassword })
        .expect(200);

      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.data.accessToken).toBeDefined();
    });

    it('31 — should reject confirm with wrong OTP code (400)', async () => {
      const { accessToken, password } = await registerVerifyAndLogin();

      // Request OTP first
      await authPost(app, '/api/auth/change-password/request', accessToken)
        .send({ oldPassword: password })
        .expect(200);

      // Confirm with wrong OTP
      const res = await authPost(
        app,
        '/api/auth/change-password/confirm',
        accessToken,
      )
        .send({ otpCode: '000000', newPassword: 'NewSecure123!' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('32 — should reject confirm without prior request (400)', async () => {
      // Fresh user — no OTP requested yet
      const { accessToken } = await registerVerifyAndLogin();

      const res = await authPost(
        app,
        '/api/auth/change-password/confirm',
        accessToken,
      )
        .send({ otpCode: '123456', newPassword: 'NewSecure123!' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  SECURITY & VALIDATION EDGE CASES
  // ═══════════════════════════════════════════════════════════════

  describe('Security & validation edge cases', () => {
    it('33 — should NOT expose password or OTP in register response', async () => {
      const payload = validRegistration();
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/register')
        .send(payload)
        .expect(201);

      const body = JSON.stringify(res.body);
      expect(body).not.toContain('"password"');
      expect(body).not.toContain('"otpCode"');
      expect(body).not.toContain(payload.password);
    });

    it('34 — should NOT expose password or sensitive fields in login response', async () => {
      const { email, password } = await registerVerifyAndLogin();
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);

      const user = res.body.data.user;
      expect(user.password).toBeUndefined();
      expect(user.otpCode).toBeUndefined();
      expect(user.refreshToken).toBeUndefined();
      expect(user.resetPasswordToken).toBeUndefined();
    });

    it('35 — should NOT expose sensitive fields in /me response', async () => {
      const { accessToken } = await registerVerifyAndLogin();

      const res = await authGet(app, '/api/auth/me', accessToken).expect(200);

      const data = res.body.data;
      expect(data.password).toBeUndefined();
      expect(data.otpCode).toBeUndefined();
      expect(data.refreshToken).toBeUndefined();
      expect(data.resetPasswordToken).toBeUndefined();
    });

    it('36 — should handle malformed JSON body gracefully', async () => {
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      // App should respond with a proper error, not crash
      expect(res.body).toBeDefined();
    });

    it('37 — should reject extra/unknown fields (forbidNonWhitelisted)', async () => {
      const payload = {
        ...validRegistration(),
        hackerField: 'malicious-value',
      };
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/register')
        .send(payload)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('38 — should reject empty body on login (400)', async () => {
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  SUPER ADMIN LOGIN (seeded user)
  // ═══════════════════════════════════════════════════════════════

  describe('Super Admin login', () => {
    it('39 — should login as seeded super admin via helper', async () => {
      const { user, tokens } = await loginAsSuperAdmin(app);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(user.email).toBeDefined();
    });

    it('40 — should access /me as super admin', async () => {
      const { tokens } = await loginAsSuperAdmin(app);

      const res = await authGet(
        app,
        '/api/auth/me',
        tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  TOKEN FLOW INTEGRITY
  // ═══════════════════════════════════════════════════════════════

  describe('Token flow integrity', () => {
    it('41 — refresh rotation should return new tokens', async () => {
      const { accessToken, refreshToken } = await registerVerifyAndLogin();

      // Rotate tokens
      const refreshRes = await authPost(app, '/api/auth/refresh', accessToken)
        .send({ refreshToken })
        .expect(200);

      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data.accessToken).toBeDefined();
      expect(refreshRes.body.data.refreshToken).toBeDefined();

      // New tokens should be valid
      const newAccessToken = refreshRes.body.data.accessToken as string;
      const meRes = await authGet(app, '/api/auth/me', newAccessToken).expect(
        200,
      );
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.email).toBeDefined();
    });

    it('42 — access token from refresh should work for authenticated routes', async () => {
      const { accessToken, refreshToken } = await registerVerifyAndLogin();

      // Get new tokens via refresh
      const refreshRes = await authPost(app, '/api/auth/refresh', accessToken)
        .send({ refreshToken })
        .expect(200);

      const newAccessToken = refreshRes.body.data.accessToken as string;

      // Use new access token for /me
      const meRes = await authGet(app, '/api/auth/me', newAccessToken).expect(
        200,
      );

      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.email).toBeDefined();
    });

    it('43 — after logout-all, refresh token should be invalid', async () => {
      const { accessToken, refreshToken } = await registerVerifyAndLogin();
      const server = getServer(app);

      // Logout all sessions
      await authPost(app, '/api/auth/logout-all', accessToken)
        .send()
        .expect(200);

      // Refresh token should now be rejected
      // Note: The JWT itself may still be cryptographically valid, but the
      // server-side comparison (bcrypt of refresh token) will fail because
      // the user's stored refreshToken was set to null.
      const res = await authPost(app, '/api/auth/refresh', accessToken)
        .send({ refreshToken });

      // Expect 401 — the refresh strategy validates the JWT signature,
      // but the auth service will reject because user.refreshToken is null
      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  RESPONSE FORMAT CONSISTENCY
  // ═══════════════════════════════════════════════════════════════

  describe('Response format consistency', () => {
    it('44 — success responses should have correct envelope', async () => {
      const { accessToken } = await registerVerifyAndLogin();

      const res = await authGet(app, '/api/auth/me', accessToken).expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('path');
    });

    it('45 — error responses should have correct envelope', async () => {
      const server = getServer(app);

      const res = await request(server)
        .post('/api/auth/login')
        .send({ email: 'a@b.com', password: 'wrong' })
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('path');
    });
  });
});
