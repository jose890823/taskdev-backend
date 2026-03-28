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
} from './helpers/e2e-setup';

/* ── Unauthenticated request helpers (no Bearer token) ──────────── */

// supertest's default export is a callable, but under nodenext moduleResolution
// `import * as request` exposes it as a namespace. Cast to keep TS happy at compile-time.
const agent = request as unknown as (
  app: import('http').Server,
) => request.SuperTest<request.Test>;

function unauthGet(app: INestApplication, path: string): request.Test {
  return agent(getServer(app)).get(path);
}

function unauthPost(app: INestApplication, path: string): request.Test {
  return agent(getServer(app)).post(path);
}

function unauthPatch(app: INestApplication, path: string): request.Test {
  return agent(getServer(app)).patch(path);
}

function unauthDelete(app: INestApplication, path: string): request.Test {
  return agent(getServer(app)).delete(path);
}

describe('Organizations (e2e)', () => {
  let app: INestApplication;
  let adminAuth: {
    user: any;
    tokens: { accessToken: string; refreshToken: string };
  };
  let userAuth: {
    user: any;
    tokens: { accessToken: string; refreshToken: string };
  };
  let secondUserAuth: {
    user: any;
    tokens: { accessToken: string; refreshToken: string };
  };

  beforeAll(async () => {
    app = await createE2EApp();
    await clearSecurityRecords();
    adminAuth = await loginAsSuperAdmin(app);
    userAuth = await createTestUser(app);
    secondUserAuth = await createTestUser(app);
  }, 60000);

  afterAll(async () => {
    await cleanupTestData();
    await closeE2EApp();
  });

  // ─── Organization CRUD ─────────────────────────────────────────

  describe('POST /api/organizations', () => {
    it('1. should create an organization (201)', async () => {
      const res = await authPost(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      )
        .send({ name: 'E2E Test Org', description: 'Created by e2e test' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.name).toBe('E2E Test Org');
      expect(res.body.data.description).toBe('Created by e2e test');
      expect(res.body.data.slug).toBe('e2e-test-org');
      expect(res.body.data.ownerId).toBe(userAuth.user.id);
      expect(res.body.data.id).toBeDefined();
    });

    it('2. should reject create without name (400)', async () => {
      const res = await authPost(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      )
        .send({ description: 'Missing name' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should reject create with empty name (400)', async () => {
      const res = await authPost(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      )
        .send({ name: '' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should reject create with duplicate slug name (409)', async () => {
      // First create
      await authPost(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      )
        .send({ name: 'Unique Slug Org' })
        .expect(201);

      // Second create with same name → conflict
      const res = await authPost(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      )
        .send({ name: 'Unique Slug Org' })
        .expect(409);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/organizations', () => {
    it('3. should list user\'s organizations', async () => {
      // Create an org first
      await authPost(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      )
        .send({ name: 'List Test Org' })
        .expect(201);

      const res = await authGet(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // All returned orgs should belong to (or include) this user
      const orgNames = res.body.data.map((o: any) => o.name);
      expect(orgNames).toContain('List Test Org');
    });

    it('25. regular user should NOT see other user\'s orgs', async () => {
      // secondUser creates an org
      await authPost(
        app,
        '/api/organizations',
        secondUserAuth.tokens.accessToken,
      )
        .send({ name: 'SecondUser Private Org' })
        .expect(201);

      // userAuth lists — should NOT see secondUser's org
      const res = await authGet(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      ).expect(200);

      const orgNames = res.body.data.map((o: any) => o.name);
      expect(orgNames).not.toContain('SecondUser Private Org');
    });

    it('26. super admin should see all organizations', async () => {
      const res = await authGet(
        app,
        '/api/organizations',
        adminAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      // Super admin should see orgs from both users
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/organizations/:id', () => {
    let orgId: string;

    beforeAll(async () => {
      const res = await authPost(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      )
        .send({ name: 'GetById Test Org' })
        .expect(201);

      orgId = res.body.data.id;
    });

    it('4. should get organization by ID', async () => {
      const res = await authGet(
        app,
        `/api/organizations/${orgId}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(orgId);
      expect(res.body.data.name).toBe('GetById Test Org');
    });

    it('5. should reject get for non-member (403)', async () => {
      const res = await authGet(
        app,
        `/api/organizations/${orgId}`,
        secondUserAuth.tokens.accessToken,
      ).expect(403);

      expect(res.body.success).toBe(false);
    });

    it('should return 404 for non-existent org', async () => {
      const fakeUuid = '00000000-0000-4000-a000-000000000000';
      const res = await authGet(
        app,
        `/api/organizations/${fakeUuid}`,
        userAuth.tokens.accessToken,
      ).expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/organizations/:id', () => {
    let orgId: string;

    beforeAll(async () => {
      const res = await authPost(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      )
        .send({ name: 'Update Test Org' })
        .expect(201);

      orgId = res.body.data.id;
    });

    it('6. should update organization name', async () => {
      const res = await authPatch(
        app,
        `/api/organizations/${orgId}`,
        userAuth.tokens.accessToken,
      )
        .send({ name: 'Updated Org Name' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Org Name');
      expect(res.body.data.slug).toBe('updated-org-name');
    });

    it('should update only description without changing name', async () => {
      const res = await authPatch(
        app,
        `/api/organizations/${orgId}`,
        userAuth.tokens.accessToken,
      )
        .send({ description: 'New description' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe('New description');
      expect(res.body.data.name).toBe('Updated Org Name');
    });

    it('7. should reject update by non-admin member', async () => {
      // First add secondUser as regular member
      await authPost(
        app,
        `/api/organizations/${orgId}/members`,
        userAuth.tokens.accessToken,
      )
        .send({ userId: secondUserAuth.user.id, role: 'member' })
        .expect(201);

      // secondUser (member) tries to update
      const res = await authPatch(
        app,
        `/api/organizations/${orgId}`,
        secondUserAuth.tokens.accessToken,
      )
        .send({ name: 'Hacked Name' })
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/organizations/:id', () => {
    let orgId: string;

    beforeAll(async () => {
      const res = await authPost(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      )
        .send({ name: 'Delete Test Org' })
        .expect(201);

      orgId = res.body.data.id;

      // Add secondUser as member
      await authPost(
        app,
        `/api/organizations/${orgId}/members`,
        userAuth.tokens.accessToken,
      )
        .send({ userId: secondUserAuth.user.id, role: 'member' })
        .expect(201);
    });

    it('9. should reject delete by non-owner', async () => {
      const res = await authDelete(
        app,
        `/api/organizations/${orgId}`,
        secondUserAuth.tokens.accessToken,
      ).expect(403);

      expect(res.body.success).toBe(false);
    });

    it('8. should delete organization (owner only, soft delete)', async () => {
      const res = await authDelete(
        app,
        `/api/organizations/${orgId}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);

      // Verify soft delete — org should not be found anymore
      await authGet(
        app,
        `/api/organizations/${orgId}`,
        userAuth.tokens.accessToken,
      ).expect(404);
    });
  });

  // ─── Members ───────────────────────────────────────────────────

  describe('Organization Members', () => {
    let orgId: string;

    beforeAll(async () => {
      const res = await authPost(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      )
        .send({ name: 'Members Test Org' })
        .expect(201);

      orgId = res.body.data.id;
    });

    describe('GET /api/organizations/:id/members', () => {
      it('10. should list organization members', async () => {
        const res = await authGet(
          app,
          `/api/organizations/${orgId}/members`,
          userAuth.tokens.accessToken,
        ).expect(200);

        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      });

      it('16. creator should appear as owner in members list', async () => {
        const res = await authGet(
          app,
          `/api/organizations/${orgId}/members`,
          userAuth.tokens.accessToken,
        ).expect(200);

        const ownerMember = res.body.data.find(
          (m: any) => m.userId === userAuth.user.id,
        );
        expect(ownerMember).toBeDefined();
        expect(ownerMember.role).toBe('owner');
      });
    });

    describe('POST /api/organizations/:id/members', () => {
      it('11. should add a member to organization', async () => {
        const res = await authPost(
          app,
          `/api/organizations/${orgId}/members`,
          userAuth.tokens.accessToken,
        )
          .send({ userId: secondUserAuth.user.id, role: 'member' })
          .expect(201);

        expect(res.body.success).toBe(true);
        expect(res.body.data.userId).toBe(secondUserAuth.user.id);
        expect(res.body.data.role).toBe('member');
        expect(res.body.data.organizationId).toBe(orgId);
      });

      it('13. should reject adding same user twice (409)', async () => {
        // secondUser was already added in previous test
        const res = await authPost(
          app,
          `/api/organizations/${orgId}/members`,
          userAuth.tokens.accessToken,
        )
          .send({ userId: secondUserAuth.user.id, role: 'member' })
          .expect(409);

        expect(res.body.success).toBe(false);
      });

      it('12. should reject adding member by non-admin', async () => {
        // Create a third test user
        const thirdUser = await createTestUser(app);

        // secondUser (member) tries to add thirdUser
        const res = await authPost(
          app,
          `/api/organizations/${orgId}/members`,
          secondUserAuth.tokens.accessToken,
        )
          .send({ userId: thirdUser.user.id, role: 'member' })
          .expect(403);

        expect(res.body.success).toBe(false);
      });
    });

    describe('DELETE /api/organizations/:id/members/:userId', () => {
      it('15. should reject removing the owner', async () => {
        const res = await authDelete(
          app,
          `/api/organizations/${orgId}/members/${userAuth.user.id}`,
          userAuth.tokens.accessToken,
        ).expect(403);

        expect(res.body.success).toBe(false);
      });

      it('14. should remove a member from organization', async () => {
        // secondUser was added earlier, now remove them
        const res = await authDelete(
          app,
          `/api/organizations/${orgId}/members/${secondUserAuth.user.id}`,
          userAuth.tokens.accessToken,
        ).expect(200);

        expect(res.body.success).toBe(true);

        // Verify member was removed
        const membersRes = await authGet(
          app,
          `/api/organizations/${orgId}/members`,
          userAuth.tokens.accessToken,
        ).expect(200);

        const memberIds = membersRes.body.data.map((m: any) => m.userId);
        expect(memberIds).not.toContain(secondUserAuth.user.id);
      });
    });
  });

  // ─── Invitations Flow ──────────────────────────────────────────

  describe('Invitations', () => {
    let orgId: string;
    let invitationToken: string;
    let invitationId: string;

    beforeAll(async () => {
      const res = await authPost(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      )
        .send({ name: 'Invitations Test Org' })
        .expect(201);

      orgId = res.body.data.id;
    });

    describe('POST /api/organizations/:id/invitations', () => {
      it('17. should create invitation for org', async () => {
        const inviteeEmail = `invited-${Date.now()}@test.com`;
        const res = await authPost(
          app,
          `/api/organizations/${orgId}/invitations`,
          userAuth.tokens.accessToken,
        )
          .send({ email: inviteeEmail, role: 'member' });

        expect(res.status).toBe(201);

        expect(res.body.success).toBe(true);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.email).toBe(inviteeEmail);
        expect(res.body.data.organizationId).toBe(orgId);
        expect(res.body.data.token).toBeDefined();
        expect(res.body.data.status).toBe('pending');

        invitationToken = res.body.data.token;
        invitationId = res.body.data.id;
      });

      it('21. should reject duplicate invitation to same email', async () => {
        const duplicateEmail = `dup-invite-${Date.now()}@test.com`;

        // First invitation
        await authPost(
          app,
          `/api/organizations/${orgId}/invitations`,
          userAuth.tokens.accessToken,
        )
          .send({ email: duplicateEmail })
          .expect(201);

        // Duplicate
        const res = await authPost(
          app,
          `/api/organizations/${orgId}/invitations`,
          userAuth.tokens.accessToken,
        )
          .send({ email: duplicateEmail })
          .expect(409);

        expect(res.body.success).toBe(false);
      });

      it('should reject invitation creation by non-admin member', async () => {
        // Add secondUser as regular member
        await authPost(
          app,
          `/api/organizations/${orgId}/members`,
          userAuth.tokens.accessToken,
        )
          .send({ userId: secondUserAuth.user.id, role: 'member' })
          .expect(201);

        const res = await authPost(
          app,
          `/api/organizations/${orgId}/invitations`,
          secondUserAuth.tokens.accessToken,
        )
          .send({ email: `some-random-${Date.now()}@test.com` })
          .expect(403);

        expect(res.body.success).toBe(false);

        // Clean up: remove secondUser
        await authDelete(
          app,
          `/api/organizations/${orgId}/members/${secondUserAuth.user.id}`,
          userAuth.tokens.accessToken,
        ).expect(200);
      });
    });

    describe('GET /api/organizations/:id/invitations', () => {
      it('18. should list org invitations', async () => {
        const res = await authGet(
          app,
          `/api/organizations/${orgId}/invitations`,
          userAuth.tokens.accessToken,
        ).expect(200);

        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);
      });
    });

    describe('GET /api/invitations/info/:token (public)', () => {
      it('19. should get invitation info by token (public route)', async () => {
        // This is a @Public() route — no auth needed
        const res = await unauthGet(
          app,
          `/api/invitations/info/${invitationToken}`,
        ).expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.organizationName).toBe('Invitations Test Org');
        expect(res.body.data.status).toBe('pending');
        expect(res.body.data.expired).toBe(false);
      });

      it('should return 404 for invalid token', async () => {
        const res = await unauthGet(
          app,
          '/api/invitations/info/totally-invalid-token',
        ).expect(404);

        expect(res.body.success).toBe(false);
      });
    });

    describe('POST /api/invitations/accept/:token', () => {
      let acceptOrgId: string;
      let acceptToken: string;
      let inviteeAuth: {
        user: any;
        tokens: { accessToken: string; refreshToken: string };
      };

      beforeAll(async () => {
        // Create a dedicated org for acceptance test
        const orgRes = await authPost(
          app,
          '/api/organizations',
          userAuth.tokens.accessToken,
        )
          .send({ name: 'Acceptance Test Org' })
          .expect(201);

        acceptOrgId = orgRes.body.data.id;

        // Create a new user that will accept the invitation
        inviteeAuth = await createTestUser(app);

        // Create invitation for that user's email
        const invRes = await authPost(
          app,
          `/api/organizations/${acceptOrgId}/invitations`,
          userAuth.tokens.accessToken,
        )
          .send({ email: inviteeAuth.user.email, role: 'member' })
          .expect(201);

        acceptToken = invRes.body.data.token;
      });

      it('20. should accept invitation and join org', async () => {
        const res = await authPost(
          app,
          `/api/invitations/accept/${acceptToken}`,
          inviteeAuth.tokens.accessToken,
        ).expect(201);

        expect(res.body.success).toBe(true);

        // Verify user is now a member
        const membersRes = await authGet(
          app,
          `/api/organizations/${acceptOrgId}/members`,
          userAuth.tokens.accessToken,
        ).expect(200);

        const memberUserIds = membersRes.body.data.map(
          (m: any) => m.userId,
        );
        expect(memberUserIds).toContain(inviteeAuth.user.id);
      });

      it('23. should reject invitation acceptance with wrong token', async () => {
        const res = await authPost(
          app,
          '/api/invitations/accept/completely-fake-token-12345',
          secondUserAuth.tokens.accessToken,
        ).expect(404);

        expect(res.body.success).toBe(false);
      });

      it('should reject accepting an already accepted invitation', async () => {
        // acceptToken was already used above
        const res = await authPost(
          app,
          `/api/invitations/accept/${acceptToken}`,
          inviteeAuth.tokens.accessToken,
        ).expect(404);

        expect(res.body.success).toBe(false);
      });

      it('should reject acceptance when email does not match', async () => {
        // Create a fresh invitation for a specific email
        const targetEmail = `target-${Date.now()}@test.com`;
        const invRes = await authPost(
          app,
          `/api/organizations/${acceptOrgId}/invitations`,
          userAuth.tokens.accessToken,
        )
          .send({ email: targetEmail, role: 'member' })
          .expect(201);

        const mismatchToken = invRes.body.data.token;

        // A different user (whose email doesn't match) tries to accept
        const res = await authPost(
          app,
          `/api/invitations/accept/${mismatchToken}`,
          secondUserAuth.tokens.accessToken,
        ).expect(400);

        expect(res.body.success).toBe(false);
      });
    });

    describe('DELETE /api/invitations/:id', () => {
      it('22. should cancel (delete) invitation', async () => {
        // Create a fresh invitation to cancel
        const invEmail = `cancel-${Date.now()}@test.com`;
        const invRes = await authPost(
          app,
          `/api/organizations/${orgId}/invitations`,
          userAuth.tokens.accessToken,
        )
          .send({ email: invEmail })
          .expect(201);

        const cancelId = invRes.body.data.id;

        const res = await authDelete(
          app,
          `/api/invitations/${cancelId}`,
          userAuth.tokens.accessToken,
        ).expect(200);

        expect(res.body.success).toBe(true);
      });

      it('should return 404 when cancelling non-existent invitation', async () => {
        const fakeUuid = '00000000-0000-4000-a000-000000000000';

        const res = await authDelete(
          app,
          `/api/invitations/${fakeUuid}`,
          userAuth.tokens.accessToken,
        ).expect(404);

        expect(res.body.success).toBe(false);
      });
    });
  });

  // ─── Authorization ─────────────────────────────────────────────

  describe('Authorization', () => {
    it('24. should reject all operations without auth token (401)', async () => {
      const fakeUuid = '00000000-0000-4000-a000-000000000000';

      // POST create org
      await unauthPost(app, '/api/organizations')
        .send({ name: 'No Auth Org' })
        .expect(401);

      // GET list orgs
      await unauthGet(app, '/api/organizations').expect(401);

      // GET org by id
      await unauthGet(app, `/api/organizations/${fakeUuid}`).expect(401);

      // PATCH org
      await unauthPatch(app, `/api/organizations/${fakeUuid}`)
        .send({ name: 'Hacked' })
        .expect(401);

      // DELETE org
      await unauthDelete(app, `/api/organizations/${fakeUuid}`).expect(401);

      // GET members
      await unauthGet(
        app,
        `/api/organizations/${fakeUuid}/members`,
      ).expect(401);

      // POST add member
      await unauthPost(
        app,
        `/api/organizations/${fakeUuid}/members`,
      )
        .send({ userId: 'some-id', role: 'member' })
        .expect(401);

      // DELETE member
      await unauthDelete(
        app,
        `/api/organizations/${fakeUuid}/members/some-user`,
      ).expect(401);

      // POST create invitation
      await unauthPost(
        app,
        `/api/organizations/${fakeUuid}/invitations`,
      )
        .send({ email: 'test@test.com' })
        .expect(401);

      // GET list invitations
      await unauthGet(
        app,
        `/api/organizations/${fakeUuid}/invitations`,
      ).expect(401);

      // POST accept invitation (requires auth)
      await unauthPost(app, '/api/invitations/accept/some-token').expect(401);

      // DELETE cancel invitation
      await unauthDelete(
        app,
        `/api/invitations/${fakeUuid}`,
      ).expect(401);
    });

    it('should allow super admin to access any organization', async () => {
      // userAuth creates an org
      const orgRes = await authPost(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      )
        .send({ name: 'Admin Access Test Org' })
        .expect(201);

      const orgId = orgRes.body.data.id;

      // Super admin (not a member) can still access it
      const res = await authGet(
        app,
        `/api/organizations/${orgId}`,
        adminAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(orgId);
    });

    it('should allow super admin to list org members', async () => {
      // Create org
      const orgRes = await authPost(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      )
        .send({ name: 'Admin Members Access Org' })
        .expect(201);

      const orgId = orgRes.body.data.id;

      // Super admin can see members even though not a member
      const res = await authGet(
        app,
        `/api/organizations/${orgId}/members`,
        adminAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ─── Edge Cases ────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should create org with only name (no description)', async () => {
      const res = await authPost(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      )
        .send({ name: 'Minimal Org' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Minimal Org');
      expect(res.body.data.description).toBeNull();
    });

    it('should generate correct slug from accented name', async () => {
      const res = await authPost(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      )
        .send({ name: 'Organización Técnica Única' })
        .expect(201);

      expect(res.body.data.slug).toBe('organizacion-tecnica-unica');
    });

    it('should reject forbidden properties in create (whitelist)', async () => {
      const res = await authPost(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      )
        .send({
          name: 'Whitelist Test Org',
          isActive: false,
          ownerId: '00000000-0000-4000-a000-000000000000',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should allow admin role member to update org', async () => {
      // Create org as userAuth
      const orgRes = await authPost(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      )
        .send({ name: 'Admin Update Test Org' })
        .expect(201);

      const orgId = orgRes.body.data.id;

      // Add secondUser as admin
      await authPost(
        app,
        `/api/organizations/${orgId}/members`,
        userAuth.tokens.accessToken,
      )
        .send({ userId: secondUserAuth.user.id, role: 'admin' })
        .expect(201);

      // secondUser (admin) should be able to update
      const res = await authPatch(
        app,
        `/api/organizations/${orgId}`,
        secondUserAuth.tokens.accessToken,
      )
        .send({ description: 'Updated by admin member' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe('Updated by admin member');
    });

    it('admin member should NOT be able to delete org (only owner)', async () => {
      const orgRes = await authPost(
        app,
        '/api/organizations',
        userAuth.tokens.accessToken,
      )
        .send({ name: 'Admin Cannot Delete Org' })
        .expect(201);

      const orgId = orgRes.body.data.id;

      // Add secondUser as admin
      await authPost(
        app,
        `/api/organizations/${orgId}/members`,
        userAuth.tokens.accessToken,
      )
        .send({ userId: secondUserAuth.user.id, role: 'admin' })
        .expect(201);

      // Admin tries to delete — should be forbidden (only owner)
      const res = await authDelete(
        app,
        `/api/organizations/${orgId}`,
        secondUserAuth.tokens.accessToken,
      ).expect(403);

      expect(res.body.success).toBe(false);
    });
  });
});
