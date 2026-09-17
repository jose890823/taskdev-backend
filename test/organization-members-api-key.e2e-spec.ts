import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  cleanupTestData,
  closeE2EApp,
  createE2EApp,
  createTestUser,
  getDataSource,
  getServer,
} from './helpers/e2e-setup';

process.env.MCP_API_KEY_PEPPER_V1 = 'e2e-only-api-key-pepper';
process.env.TASKHUB_MCP_API_KEY_MANAGEMENT_ENABLED = 'true';
process.env.TASKHUB_MCP_API_KEY_AUTHENTICATION_ENABLED = 'true';
process.env.TASKHUB_MCP_API_KEY_EMERGENCY_DISABLE = 'false';

describe('Organization member API-key boundary (e2e)', () => {
  let app: INestApplication;
  let jwt: string;
  let organizationId: string;
  let projectId: string;
  let apiKeyId: string;
  let apiKeySecret: string;

  beforeAll(async () => {
    app = await createE2EApp();
    const owner = await createTestUser(app);
    const additionalMember = await createTestUser(app);
    jwt = owner.tokens.accessToken;

    const server = getServer(app);
    const organizationResponse = await request(server)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ name: `API key members e2e ${Date.now()}` })
      .expect(201);
    organizationId = organizationResponse.body.data.id as string;

    await request(server)
      .post(`/api/organizations/${organizationId}/members`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ userId: additionalMember.user.id, role: 'member' })
      .expect(201);

    const projectResponse = await request(server)
      .post('/api/projects')
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        name: `API key members project ${Date.now()}`,
        organizationId,
      })
      .expect(201);
    projectId = projectResponse.body.data.id as string;

    const keyResponse = await request(server)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${jwt}`)
      .send({
        name: 'E2E organization members boundary key',
        projectId,
        scopes: ['organizations:read'],
        expirationDays: 90,
      })
      .expect(201);
    apiKeyId = keyResponse.body.data.id as string;
    apiKeySecret = keyResponse.body.data.secret as string;
  }, 60000);

  afterAll(async () => {
    if (app) {
      await getDataSource().query('DELETE FROM mcp_api_keys');
      await cleanupTestData();
      await closeE2EApp();
    }
  });

  it('rejects a project-bound key from enumerating members while preserving JWT access', async () => {
    const membersPath = `/api/organizations/${organizationId}/members`;
    const server = getServer(app);

    const apiKeyResponse = await request(server)
      .get(membersPath)
      .query({ projectId })
      .set('Authorization', `Bearer ${apiKeySecret}`)
      .expect(403);

    expect(apiKeyResponse.body.error).toEqual({
      code: 'PROJECT_ACCESS_DENIED',
      message:
        'Los miembros de la organización no están disponibles para API keys vinculadas a proyectos',
      details: null,
    });
    expect(JSON.stringify(apiKeyResponse.body)).not.toContain(apiKeySecret);

    const jwtResponse = await request(server)
      .get(membersPath)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(jwtResponse.body.success).toBe(true);
    expect(jwtResponse.body.data).toHaveLength(2);
    expect(jwtResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'owner' }),
        expect.objectContaining({ role: 'member' }),
      ]),
    );

    const keyRecord = await getDataSource().query(
      'SELECT id FROM mcp_api_keys WHERE id = $1',
      [apiKeyId],
    );
    expect(keyRecord).toHaveLength(1);
  });
});
