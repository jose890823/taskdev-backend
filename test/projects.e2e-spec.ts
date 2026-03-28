/**
 * Projects Module — E2E Test Suite
 *
 * Covers: Project CRUD, Members, Task Statuses, Project Modules.
 * Tests auth enforcement, role-based access, and cross-cutting concerns.
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
  authPatch,
  authDelete,
  clearSecurityRecords,
  AuthenticatedUser,
} from './helpers/e2e-setup';

describe('Projects (e2e)', () => {
  let app: INestApplication;
  let adminAuth: AuthenticatedUser;
  let userAuth: AuthenticatedUser;
  let user2Auth: AuthenticatedUser;

  beforeAll(async () => {
    app = await createE2EApp();
    adminAuth = await loginAsSuperAdmin(app);
    userAuth = await createTestUser(app);
    user2Auth = await createTestUser(app);
  }, 60_000);

  afterAll(async () => {
    await cleanupTestData();
    await closeE2EApp();
  });

  // ─── Shared state used across ordered tests ───────────────────
  let personalProjectId: string;
  let personalProjectSlug: string;
  let orgId: string;
  let orgProjectId: string;
  let customStatusId: string;
  let projectModuleId: string;

  // ═══════════════════════════════════════════════════════════════
  //  1. PROJECT CRUD
  // ═══════════════════════════════════════════════════════════════

  describe('Project CRUD', () => {
    it('1. Should create a personal project (201)', async () => {
      const res = await authPost(
        app,
        '/api/projects',
        userAuth.tokens.accessToken,
      )
        .send({ name: 'E2E Personal Project', description: 'Test personal' })
        .expect(201);

      const body = res.body as {
        success: boolean;
        data: { id: string; slug: string; name: string; organizationId: string | null; ownerId: string };
      };
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('E2E Personal Project');
      expect(body.data.organizationId).toBeNull();
      expect(body.data.ownerId).toBe(userAuth.user.id);
      expect(body.data.slug).toBeDefined();

      personalProjectId = body.data.id;
      personalProjectSlug = body.data.slug;
    });

    it('2. Should create an org project (need org first)', async () => {
      // Step 1: Create an organization as the regular user
      const orgRes = await authPost(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      )
        .send({ name: 'E2E Test Org', description: 'Org for project tests' })
        .expect(201);

      const orgBody = orgRes.body as {
        success: boolean;
        data: { id: string };
      };
      orgId = orgBody.data.id;

      // Step 2: Create project under the organization
      const res = await authPost(
        app,
        '/api/projects',
        userAuth.tokens.accessToken,
      )
        .send({
          name: 'E2E Org Project',
          description: 'Project inside org',
          organizationId: orgId,
        })
        .expect(201);

      const body = res.body as {
        success: boolean;
        data: { id: string; organizationId: string };
      };
      expect(body.success).toBe(true);
      expect(body.data.organizationId).toBe(orgId);

      orgProjectId = body.data.id;
    });

    it('3. Should auto-create 4 default task statuses on project creation', async () => {
      // Give the event emitter a moment to process
      await new Promise((resolve) => setTimeout(resolve, 500));

      const res = await authGet(
        app,
        `/api/projects/${personalProjectId}/statuses`,
        userAuth.tokens.accessToken,
      ).expect(200);

      const body = res.body as {
        success: boolean;
        data: Array<{
          name: string;
          isDefault: boolean;
          isCompleted: boolean;
          projectId: string;
        }>;
      };
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(4);

      const names = body.data.map((s) => s.name);
      expect(names).toContain('Por hacer');
      expect(names).toContain('En progreso');
      expect(names).toContain('En revision');
      expect(names).toContain('Completado');

      const defaultStatus = body.data.find((s) => s.isDefault);
      expect(defaultStatus).toBeDefined();
      expect(defaultStatus!.name).toBe('Por hacer');

      const completedStatus = body.data.find((s) => s.isCompleted);
      expect(completedStatus).toBeDefined();
      expect(completedStatus!.name).toBe('Completado');
    });

    it('4. Should reject project creation without name (400)', async () => {
      const res = await authPost(
        app,
        '/api/projects',
        userAuth.tokens.accessToken,
      )
        .send({ description: 'Missing name' })
        .expect(400);

      const body = res.body as { success: boolean };
      expect(body.success).toBe(false);
    });

    it('5. Should list personal projects', async () => {
      const res = await authGet(
        app,
        '/api/projects?personal=true',
        userAuth.tokens.accessToken,
      ).expect(200);

      const body = res.body as {
        success: boolean;
        data: Array<{ id: string; organizationId: string | null }>;
      };
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);

      // All returned projects should have no organization
      body.data.forEach((p) => {
        expect(p.organizationId).toBeNull();
      });

      // Our personal project should be in the list
      const found = body.data.find((p) => p.id === personalProjectId);
      expect(found).toBeDefined();
    });

    it('6. Should list org projects', async () => {
      const res = await authGet(
        app,
        `/api/projects?organizationId=${orgId}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      const body = res.body as {
        success: boolean;
        data: Array<{ id: string; organizationId: string }>;
      };
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);

      body.data.forEach((p) => {
        expect(p.organizationId).toBe(orgId);
      });

      const found = body.data.find((p) => p.id === orgProjectId);
      expect(found).toBeDefined();
    });

    it('7. Should get project by ID', async () => {
      const res = await authGet(
        app,
        `/api/projects/${personalProjectId}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      const body = res.body as {
        success: boolean;
        data: { id: string; name: string };
      };
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(personalProjectId);
      expect(body.data.name).toBe('E2E Personal Project');
    });

    it('8. Should get project by slug', async () => {
      const res = await authGet(
        app,
        `/api/projects/by-slug/${personalProjectSlug}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      const body = res.body as {
        success: boolean;
        data: { id: string; slug: string };
      };
      expect(body.success).toBe(true);
      expect(body.data.slug).toBe(personalProjectSlug);
    });

    it('9. Should update project', async () => {
      const res = await authPatch(
        app,
        `/api/projects/${personalProjectId}`,
        userAuth.tokens.accessToken,
      )
        .send({ name: 'E2E Personal Project Updated', color: '#ef4444' })
        .expect(200);

      const body = res.body as {
        success: boolean;
        data: { name: string; color: string };
      };
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('E2E Personal Project Updated');
      expect(body.data.color).toBe('#ef4444');
    });

    it('10. Should delete project (owner only)', async () => {
      // Create a disposable project to delete
      const createRes = await authPost(
        app,
        '/api/projects',
        userAuth.tokens.accessToken,
      )
        .send({ name: 'E2E Project To Delete' })
        .expect(201);

      const createBody = createRes.body as {
        data: { id: string };
      };
      const disposableId = createBody.data.id;

      await authDelete(
        app,
        `/api/projects/${disposableId}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      // Verify it's gone (soft deleted)
      await authGet(
        app,
        `/api/projects/${disposableId}`,
        userAuth.tokens.accessToken,
      ).expect(404);
    });

    it('11. Should reject delete by non-owner (403)', async () => {
      // user2 is NOT the owner of personalProject
      await authDelete(
        app,
        `/api/projects/${personalProjectId}`,
        user2Auth.tokens.accessToken,
      ).expect(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  2. MEMBERS
  // ═══════════════════════════════════════════════════════════════

  describe('Members', () => {
    it('12. Should list project members', async () => {
      const res = await authGet(
        app,
        `/api/projects/${personalProjectId}/members`,
        userAuth.tokens.accessToken,
      ).expect(200);

      const body = res.body as {
        success: boolean;
        data: Array<{ userId: string; role: string }>;
      };
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('13. Creator should be owner', async () => {
      const res = await authGet(
        app,
        `/api/projects/${personalProjectId}/members`,
        userAuth.tokens.accessToken,
      ).expect(200);

      const body = res.body as {
        data: Array<{ userId: string; role: string }>;
      };
      const ownerMember = body.data.find(
        (m) => m.userId === userAuth.user.id,
      );
      expect(ownerMember).toBeDefined();
      expect(ownerMember!.role).toBe('owner');
    });

    it('14. Should add member to project', async () => {
      const res = await authPost(
        app,
        `/api/projects/${personalProjectId}/members`,
        userAuth.tokens.accessToken,
      )
        .send({ userId: user2Auth.user.id, role: 'member' })
        .expect(201);

      const body = res.body as {
        success: boolean;
        data: { userId: string; role: string; projectId: string };
      };
      expect(body.success).toBe(true);
      expect(body.data.userId).toBe(user2Auth.user.id);
      expect(body.data.role).toBe('member');
    });

    it('15. Should reject adding member by non-admin (403)', async () => {
      // user2 is a regular member, not admin — should not be able to add members
      const newUser = await createTestUser(app);

      await authPost(
        app,
        `/api/projects/${personalProjectId}/members`,
        user2Auth.tokens.accessToken,
      )
        .send({ userId: newUser.user.id, role: 'member' })
        .expect(403);
    });

    it('16. Should remove member from project', async () => {
      await authDelete(
        app,
        `/api/projects/${personalProjectId}/members/${user2Auth.user.id}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      // Verify member was removed
      const res = await authGet(
        app,
        `/api/projects/${personalProjectId}/members`,
        userAuth.tokens.accessToken,
      ).expect(200);

      const body = res.body as {
        data: Array<{ userId: string }>;
      };
      const removed = body.data.find(
        (m) => m.userId === user2Auth.user.id,
      );
      expect(removed).toBeUndefined();
    });

    it('17. Non-member should not access project (403)', async () => {
      // user2 was removed, should not be able to access
      await authGet(
        app,
        `/api/projects/${personalProjectId}`,
        user2Auth.tokens.accessToken,
      ).expect(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  3. TASK STATUSES
  // ═══════════════════════════════════════════════════════════════

  describe('Task Statuses', () => {
    it('18. Should list project statuses (4 defaults)', async () => {
      const res = await authGet(
        app,
        `/api/projects/${personalProjectId}/statuses`,
        userAuth.tokens.accessToken,
      ).expect(200);

      const body = res.body as {
        success: boolean;
        data: Array<{ name: string; projectId: string }>;
      };
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(4);
      body.data.forEach((s) => {
        expect(s.projectId).toBe(personalProjectId);
      });
    });

    it('19. Should list global statuses', async () => {
      const res = await authGet(
        app,
        '/api/task-statuses/global',
        userAuth.tokens.accessToken,
      ).expect(200);

      const body = res.body as {
        success: boolean;
        data: Array<{ name: string; projectId: string | null }>;
      };
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(3);

      const names = body.data.map((s) => s.name);
      expect(names).toContain('Por hacer');
      expect(names).toContain('En progreso');
      expect(names).toContain('Completado');

      // Global statuses should have null projectId
      body.data.forEach((s) => {
        expect(s.projectId).toBeNull();
      });
    });

    it('20. Should create custom status', async () => {
      const res = await authPost(
        app,
        `/api/projects/${personalProjectId}/statuses`,
        userAuth.tokens.accessToken,
      )
        .send({
          name: 'Bloqueado',
          color: '#ef4444',
          icon: 'block',
          isDefault: false,
          isCompleted: false,
        })
        .expect(201);

      const body = res.body as {
        success: boolean;
        data: { id: string; name: string; color: string; projectId: string };
      };
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Bloqueado');
      expect(body.data.color).toBe('#ef4444');
      expect(body.data.projectId).toBe(personalProjectId);

      customStatusId = body.data.id;
    });

    it('21. Should update status', async () => {
      const res = await authPatch(
        app,
        `/api/task-statuses/${customStatusId}`,
        userAuth.tokens.accessToken,
      )
        .send({ name: 'Bloqueado Critico', color: '#dc2626' })
        .expect(200);

      const body = res.body as {
        success: boolean;
        data: { name: string; color: string };
      };
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Bloqueado Critico');
      expect(body.data.color).toBe('#dc2626');
    });

    it('22. Should delete status', async () => {
      await authDelete(
        app,
        `/api/task-statuses/${customStatusId}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      // Verify the status count went back to 4
      const res = await authGet(
        app,
        `/api/projects/${personalProjectId}/statuses`,
        userAuth.tokens.accessToken,
      ).expect(200);

      const body = res.body as {
        data: Array<{ id: string }>;
      };
      expect(body.data).toHaveLength(4);
    });

    it('23. Should reject status operations by non-admin', async () => {
      // Re-add user2 as a regular member first
      await authPost(
        app,
        `/api/projects/${personalProjectId}/members`,
        userAuth.tokens.accessToken,
      )
        .send({ userId: user2Auth.user.id, role: 'member' })
        .expect(201);

      // user2 (member) should NOT be able to create statuses
      await authPost(
        app,
        `/api/projects/${personalProjectId}/statuses`,
        user2Auth.tokens.accessToken,
      )
        .send({ name: 'Unauthorized Status' })
        .expect(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  4. PROJECT MODULES
  // ═══════════════════════════════════════════════════════════════

  describe('Project Modules', () => {
    it('24. Should create project module', async () => {
      const res = await authPost(
        app,
        `/api/projects/${personalProjectId}/modules`,
        userAuth.tokens.accessToken,
      )
        .send({
          name: 'Frontend',
          description: 'Frontend module',
          color: '#8b5cf6',
        })
        .expect(201);

      const body = res.body as {
        success: boolean;
        data: {
          id: string;
          name: string;
          description: string;
          projectId: string;
        };
      };
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Frontend');
      expect(body.data.projectId).toBe(personalProjectId);

      projectModuleId = body.data.id;
    });

    it('25. Should list project modules', async () => {
      // Create a second module for a richer list
      await authPost(
        app,
        `/api/projects/${personalProjectId}/modules`,
        userAuth.tokens.accessToken,
      )
        .send({ name: 'Backend', description: 'Backend module' })
        .expect(201);

      const res = await authGet(
        app,
        `/api/projects/${personalProjectId}/modules?flat=true`,
        userAuth.tokens.accessToken,
      ).expect(200);

      const body = res.body as {
        success: boolean;
        data: Array<{ name: string; projectId: string }>;
      };
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(2);

      const names = body.data.map((m) => m.name);
      expect(names).toContain('Frontend');
      expect(names).toContain('Backend');
    });

    it('26. Should update module', async () => {
      const res = await authPatch(
        app,
        `/api/project-modules/${projectModuleId}`,
        userAuth.tokens.accessToken,
      )
        .send({ name: 'Frontend v2', description: 'Updated frontend module' })
        .expect(200);

      const body = res.body as {
        success: boolean;
        data: { name: string; description: string };
      };
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Frontend v2');
      expect(body.data.description).toBe('Updated frontend module');
    });

    it('27. Should delete module', async () => {
      // Create a disposable module to delete
      const createRes = await authPost(
        app,
        `/api/projects/${personalProjectId}/modules`,
        userAuth.tokens.accessToken,
      )
        .send({ name: 'Disposable Module' })
        .expect(201);

      const createBody = createRes.body as {
        data: { id: string };
      };
      const disposableModuleId = createBody.data.id;

      await authDelete(
        app,
        `/api/project-modules/${disposableModuleId}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      // Verify it was deleted by listing modules
      const listRes = await authGet(
        app,
        `/api/projects/${personalProjectId}/modules?flat=true`,
        userAuth.tokens.accessToken,
      ).expect(200);

      const listBody = listRes.body as {
        data: Array<{ id: string }>;
      };
      const found = listBody.data.find(
        (m) => m.id === disposableModuleId,
      );
      expect(found).toBeUndefined();
    });

    it('28. Should reject module operations by non-admin', async () => {
      // user2 is a regular member — should NOT be able to create modules
      await authPost(
        app,
        `/api/projects/${personalProjectId}/modules`,
        user2Auth.tokens.accessToken,
      )
        .send({ name: 'Unauthorized Module' })
        .expect(403);

      // Also should NOT be able to update
      await authPatch(
        app,
        `/api/project-modules/${projectModuleId}`,
        user2Auth.tokens.accessToken,
      )
        .send({ name: 'Hacked Name' })
        .expect(403);

      // Also should NOT be able to delete
      await authDelete(
        app,
        `/api/project-modules/${projectModuleId}`,
        user2Auth.tokens.accessToken,
      ).expect(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  5. CROSS-CUTTING CONCERNS
  // ═══════════════════════════════════════════════════════════════

  describe('Cross-cutting', () => {
    it('29. Should reject all operations without auth (401)', async () => {
      const server = getServer(app);
      /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- supertest + getHttpServer() both return any by design */
      const req = request as unknown as (app: unknown) => request.Agent;

      // Project CRUD
      await req(server).post('/api/projects').send({ name: 'No Auth' }).expect(401);
      await req(server).get('/api/projects').expect(401);
      await req(server).get(`/api/projects/${personalProjectId}`).expect(401);
      await req(server).patch(`/api/projects/${personalProjectId}`).send({ name: 'X' }).expect(401);
      await req(server).delete(`/api/projects/${personalProjectId}`).expect(401);

      // Members
      await req(server).get(`/api/projects/${personalProjectId}/members`).expect(401);
      await req(server).post(`/api/projects/${personalProjectId}/members`).send({}).expect(401);

      // Statuses
      await req(server).get(`/api/projects/${personalProjectId}/statuses`).expect(401);
      await req(server).post(`/api/projects/${personalProjectId}/statuses`).send({}).expect(401);
      await req(server).get('/api/task-statuses/global').expect(401);

      // Modules
      await req(server).get(`/api/projects/${personalProjectId}/modules`).expect(401);
      await req(server).post(`/api/projects/${personalProjectId}/modules`).send({}).expect(401);
      /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    });

    it('30. Super admin should have access to any project', async () => {
      // Super admin should be able to read a project they don't own
      const res = await authGet(
        app,
        `/api/projects/${personalProjectId}`,
        adminAuth.tokens.accessToken,
      ).expect(200);

      const body = res.body as {
        success: boolean;
        data: { id: string };
      };
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(personalProjectId);
    });

    it('31. Should reject creating project with invalid organizationId (400)', async () => {
      await authPost(
        app,
        '/api/projects',
        userAuth.tokens.accessToken,
      )
        .send({ name: 'Bad Org', organizationId: 'not-a-uuid' })
        .expect(400);
    });

    it('32. Should not list projects from other users', async () => {
      // Create a project as user2 that userAuth should NOT see
      const u2Res = await authPost(
        app,
        '/api/projects',
        user2Auth.tokens.accessToken,
      )
        .send({ name: 'User2 Private Project' })
        .expect(201);

      const u2Body = u2Res.body as {
        data: { id: string };
      };
      const user2ProjectId = u2Body.data.id;

      // userAuth should NOT have this project in their personal list
      const listRes = await authGet(
        app,
        '/api/projects?personal=true',
        userAuth.tokens.accessToken,
      ).expect(200);

      const listBody = listRes.body as {
        data: Array<{ id: string }>;
      };
      const found = listBody.data.find(
        (p) => p.id === user2ProjectId,
      );
      expect(found).toBeUndefined();
    });

    it('33. Should prevent removing the project owner from members', async () => {
      // Try to remove the owner (userAuth) from their own project
      await authDelete(
        app,
        `/api/projects/${personalProjectId}/members/${userAuth.user.id}`,
        userAuth.tokens.accessToken,
      ).expect(403);
    });

    it('34. Should reject adding a duplicate member (409)', async () => {
      // user2 is already a member (added in test 23)
      await authPost(
        app,
        `/api/projects/${personalProjectId}/members`,
        userAuth.tokens.accessToken,
      )
        .send({ userId: user2Auth.user.id, role: 'member' })
        .expect(409);
    });

    it('35. Should return 404 for non-existent project', async () => {
      const fakeId = '00000000-0000-4000-8000-000000000000';
      await authGet(
        app,
        `/api/projects/${fakeId}`,
        userAuth.tokens.accessToken,
      ).expect(404);
    });

    it('36. Super admin should be able to create status on any project', async () => {
      const res = await authPost(
        app,
        `/api/projects/${personalProjectId}/statuses`,
        adminAuth.tokens.accessToken,
      )
        .send({ name: 'Admin Custom Status', color: '#0ea5e9' })
        .expect(201);

      const body = res.body as {
        success: boolean;
        data: { id: string; name: string };
      };
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('Admin Custom Status');

      // Cleanup: delete the status we just created
      await authDelete(
        app,
        `/api/task-statuses/${body.data.id}`,
        adminAuth.tokens.accessToken,
      ).expect(200);
    });

    it('37. Should list modules as tree (no flat query)', async () => {
      const res = await authGet(
        app,
        `/api/projects/${personalProjectId}/modules`,
        userAuth.tokens.accessToken,
      ).expect(200);

      const body = res.body as {
        success: boolean;
        data: Array<{ name: string }>;
      };
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('38. Should update project slug when name changes', async () => {
      const res = await authPatch(
        app,
        `/api/projects/${personalProjectId}`,
        userAuth.tokens.accessToken,
      )
        .send({ name: 'Slug Change Test' })
        .expect(200);

      const body = res.body as {
        data: { slug: string; name: string };
      };
      expect(body.data.name).toBe('Slug Change Test');
      expect(body.data.slug).toContain('slug-change-test');

      // Update the slug reference for subsequent tests
      personalProjectSlug = body.data.slug;
    });

    it('39. Should add member with viewer role', async () => {
      const viewerUser = await createTestUser(app);

      const res = await authPost(
        app,
        `/api/projects/${personalProjectId}/members`,
        userAuth.tokens.accessToken,
      )
        .send({ userId: viewerUser.user.id, role: 'viewer' })
        .expect(201);

      const body = res.body as {
        data: { role: string; userId: string };
      };
      expect(body.data.role).toBe('viewer');
      expect(body.data.userId).toBe(viewerUser.user.id);
    });

    it('40. Should add member with admin role and allow admin operations', async () => {
      const adminMember = await createTestUser(app);

      // Add as admin
      await authPost(
        app,
        `/api/projects/${personalProjectId}/members`,
        userAuth.tokens.accessToken,
      )
        .send({ userId: adminMember.user.id, role: 'admin' })
        .expect(201);

      // Admin should be able to create a module
      const modRes = await authPost(
        app,
        `/api/projects/${personalProjectId}/modules`,
        adminMember.tokens.accessToken,
      )
        .send({ name: 'Admin Created Module' })
        .expect(201);

      const modBody = modRes.body as {
        success: boolean;
        data: { name: string };
      };
      expect(modBody.success).toBe(true);
      expect(modBody.data.name).toBe('Admin Created Module');

      // Admin should also be able to create a status
      const statusRes = await authPost(
        app,
        `/api/projects/${personalProjectId}/statuses`,
        adminMember.tokens.accessToken,
      )
        .send({ name: 'Admin Status' })
        .expect(201);

      const statusBody = statusRes.body as {
        success: boolean;
        data: { name: string };
      };
      expect(statusBody.success).toBe(true);
      expect(statusBody.data.name).toBe('Admin Status');
    });
  });
});
