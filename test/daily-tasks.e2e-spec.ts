/**
 * Daily Tasks E2E Test Suite
 *
 * Tests the full lifecycle of daily tasks: creation, listing, updating,
 * completing, deleting, and isolation between users and task types.
 *
 * Daily tasks have type='daily', do NOT require a projectId,
 * and use global task statuses seeded at startup.
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
  AuthenticatedUser,
  clearSecurityRecords,
} from './helpers/e2e-setup';

describe('Daily Tasks (e2e)', () => {
  let app: INestApplication;
  let userAuth: AuthenticatedUser;
  let otherUserAuth: AuthenticatedUser;
  let globalStatuses: {
    id: string;
    name: string;
    isDefault: boolean;
    isCompleted: boolean;
  }[];

  // Status references for convenience
  let statusPorHacer: (typeof globalStatuses)[0];
  let statusEnProgreso: (typeof globalStatuses)[0];
  let statusCompletado: (typeof globalStatuses)[0];

  const today = () => new Date().toISOString().split('T')[0];

  beforeAll(async () => {
    app = await createE2EApp();

    // Create two separate test users for isolation tests
    userAuth = await createTestUser(app);
    otherUserAuth = await createTestUser(app);

    // Get global statuses (for daily tasks)
    const statusRes = await authGet(
      app,
      '/api/task-statuses/global',
      userAuth.tokens.accessToken,
    ).expect(200);
    globalStatuses = statusRes.body.data;

    // Map statuses by name for quick reference
    statusPorHacer = globalStatuses.find((s) => s.isDefault)!;
    statusEnProgreso = globalStatuses.find(
      (s) => s.name === 'En progreso',
    )!;
    statusCompletado = globalStatuses.find((s) => s.isCompleted)!;
  });

  afterAll(async () => {
    await cleanupTestData();
    await closeE2EApp();
  });

  // ═══════════════════════════════════════════════════════════════════
  // Global Statuses Verification
  // ═══════════════════════════════════════════════════════════════════

  describe('Global Statuses', () => {
    it('21. Should have 3 global statuses available', () => {
      expect(globalStatuses).toBeDefined();
      expect(globalStatuses.length).toBe(3);
    });

    it('22. Global statuses should include "Por hacer" (isDefault), "En progreso", "Completado" (isCompleted)', () => {
      const names = globalStatuses.map((s) => s.name);

      expect(names).toContain('Por hacer');
      expect(names).toContain('En progreso');
      expect(names).toContain('Completado');

      // Verify flags
      const porHacer = globalStatuses.find((s) => s.name === 'Por hacer');
      expect(porHacer!.isDefault).toBe(true);
      expect(porHacer!.isCompleted).toBe(false);

      const enProgreso = globalStatuses.find(
        (s) => s.name === 'En progreso',
      );
      expect(enProgreso!.isDefault).toBe(false);
      expect(enProgreso!.isCompleted).toBe(false);

      const completado = globalStatuses.find(
        (s) => s.name === 'Completado',
      );
      expect(completado!.isDefault).toBe(false);
      expect(completado!.isCompleted).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Create Daily Tasks
  // ═══════════════════════════════════════════════════════════════════

  describe('Create Daily Tasks', () => {
    it('1. Should create a daily task without projectId (201)', async () => {
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Mi tarea diaria simple',
          type: 'daily',
          scheduledDate: today(),
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.title).toBe('Mi tarea diaria simple');
      expect(res.body.data.type).toBe('daily');
      expect(res.body.data.projectId).toBeNull();
      expect(res.body.data.createdById).toBe(userAuth.user.id);
      // Should auto-assign default status
      expect(res.body.data.statusId).toBe(statusPorHacer.id);
    });

    it('2. Should create daily task with scheduledDate', async () => {
      const targetDate = '2026-04-15';

      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Tarea programada para el futuro',
          type: 'daily',
          scheduledDate: targetDate,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.scheduledDate).toBe(targetDate);
      expect(res.body.data.type).toBe('daily');
    });

    it('3. Should create daily task with priority', async () => {
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Tarea urgente diaria',
          type: 'daily',
          priority: 'urgent',
          scheduledDate: today(),
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.priority).toBe('urgent');
    });

    it('4. Should create daily task with description', async () => {
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Tarea con descripcion',
          type: 'daily',
          description: 'Esta es una descripcion detallada de la tarea diaria',
          scheduledDate: today(),
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe(
        'Esta es una descripcion detallada de la tarea diaria',
      );
    });

    it('5. Should reject daily task without title (400)', async () => {
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          type: 'daily',
          scheduledDate: today(),
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('Should create daily task with explicit statusId', async () => {
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Tarea con estado explicito',
          type: 'daily',
          statusId: statusEnProgreso.id,
          scheduledDate: today(),
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.statusId).toBe(statusEnProgreso.id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // List Daily Tasks
  // ═══════════════════════════════════════════════════════════════════

  describe('List Daily Tasks', () => {
    let todayTaskId: string;

    beforeAll(async () => {
      // Create a known daily task for today to test listing
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Tarea diaria para listar hoy',
          type: 'daily',
          scheduledDate: today(),
        })
        .expect(201);
      todayTaskId = res.body.data.id;
    });

    it('6. Should list daily tasks for today (GET /api/tasks/daily)', async () => {
      const res = await authGet(
        app,
        '/api/tasks/daily',
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      // Should contain the task we just created
      const found = res.body.data.find(
        (t: any) => t.id === todayTaskId,
      );
      expect(found).toBeDefined();
      expect(found.type).toBe('daily');
    });

    it('7. Should list daily tasks for a specific date', async () => {
      const specificDate = '2026-06-01';

      // Create a task for that specific date
      await authPost(app, '/api/tasks', userAuth.tokens.accessToken)
        .send({
          title: 'Tarea para junio',
          type: 'daily',
          scheduledDate: specificDate,
        })
        .expect(201);

      const res = await authGet(
        app,
        `/api/tasks/daily?date=${specificDate}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      // All returned tasks should be for that date
      for (const task of res.body.data) {
        expect(task.scheduledDate).toBe(specificDate);
        expect(task.type).toBe('daily');
      }
    });

    it('8. Should return empty array for date with no tasks', async () => {
      const emptyDate = '2020-01-01';

      const res = await authGet(
        app,
        `/api/tasks/daily?date=${emptyDate}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(0);
    });

    it('9. Should only return daily tasks (not project tasks)', async () => {
      // All tasks returned by /api/tasks/daily must be type=daily
      const res = await authGet(
        app,
        '/api/tasks/daily',
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      for (const task of res.body.data) {
        expect(task.type).toBe('daily');
      }
    });

    it('10. Should get my daily tasks (GET /api/tasks/my?type=daily)', async () => {
      const res = await authGet(
        app,
        '/api/tasks/my?type=daily',
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      // All returned tasks should be daily
      for (const task of res.body.data) {
        expect(task.type).toBe('daily');
      }
      // Should include our created task
      const found = res.body.data.find(
        (t: any) => t.id === todayTaskId,
      );
      expect(found).toBeDefined();
    });

    it('Should reject invalid date format', async () => {
      const res = await authGet(
        app,
        '/api/tasks/daily?date=not-a-date',
        userAuth.tokens.accessToken,
      ).expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Update Daily Tasks
  // ═══════════════════════════════════════════════════════════════════

  describe('Update Daily Tasks', () => {
    let taskToUpdate: any;

    beforeAll(async () => {
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Tarea para actualizar',
          type: 'daily',
          scheduledDate: today(),
          priority: 'low',
        })
        .expect(201);
      taskToUpdate = res.body.data;
    });

    it('11. Should update daily task title', async () => {
      const res = await authPatch(
        app,
        `/api/tasks/${taskToUpdate.id}`,
        userAuth.tokens.accessToken,
      )
        .send({ title: 'Titulo actualizado' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Titulo actualizado');
    });

    it('12. Should update daily task status to "En progreso"', async () => {
      const res = await authPatch(
        app,
        `/api/tasks/${taskToUpdate.id}`,
        userAuth.tokens.accessToken,
      )
        .send({ statusId: statusEnProgreso.id })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.statusId).toBe(statusEnProgreso.id);
      // completedAt should still be null (En progreso is not completed)
      expect(res.body.data.completedAt).toBeNull();
    });

    it('13. Should update daily task priority', async () => {
      const res = await authPatch(
        app,
        `/api/tasks/${taskToUpdate.id}`,
        userAuth.tokens.accessToken,
      )
        .send({ priority: 'high' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.priority).toBe('high');
    });

    it('14. Should reschedule daily task (change scheduledDate)', async () => {
      const newDate = '2026-05-20';

      const res = await authPatch(
        app,
        `/api/tasks/${taskToUpdate.id}`,
        userAuth.tokens.accessToken,
      )
        .send({ scheduledDate: newDate })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.scheduledDate).toBe(newDate);
    });

    it('Should update daily task description', async () => {
      const res = await authPatch(
        app,
        `/api/tasks/${taskToUpdate.id}`,
        userAuth.tokens.accessToken,
      )
        .send({ description: 'Descripcion actualizada' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe('Descripcion actualizada');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Complete Daily Tasks
  // ═══════════════════════════════════════════════════════════════════

  describe('Complete Daily Tasks', () => {
    let taskToComplete: any;

    beforeAll(async () => {
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Tarea para completar',
          type: 'daily',
          scheduledDate: today(),
        })
        .expect(201);
      taskToComplete = res.body.data;
    });

    it('15. Should complete daily task (set status to "Completado")', async () => {
      const res = await authPatch(
        app,
        `/api/tasks/${taskToComplete.id}`,
        userAuth.tokens.accessToken,
      )
        .send({ statusId: statusCompletado.id })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.statusId).toBe(statusCompletado.id);
    });

    it('16. Completing should set completedAt timestamp', async () => {
      // Re-fetch the task to verify completedAt
      const res = await authGet(
        app,
        `/api/tasks/${taskToComplete.id}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.completedAt).not.toBeNull();
      // completedAt should be a valid ISO date string
      const completedAt = new Date(res.body.data.completedAt);
      expect(completedAt.getTime()).not.toBeNaN();
    });

    it('17. Should uncomplete daily task (change status back)', async () => {
      const res = await authPatch(
        app,
        `/api/tasks/${taskToComplete.id}`,
        userAuth.tokens.accessToken,
      )
        .send({ statusId: statusPorHacer.id })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.statusId).toBe(statusPorHacer.id);
      expect(res.body.data.completedAt).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Delete Daily Tasks
  // ═══════════════════════════════════════════════════════════════════

  describe('Delete Daily Tasks', () => {
    it('18. Should delete a daily task', async () => {
      // Create a task to delete
      const createRes = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Tarea para eliminar',
          type: 'daily',
          scheduledDate: today(),
        })
        .expect(201);

      const taskId = createRes.body.data.id;

      // Delete it
      await authDelete(
        app,
        `/api/tasks/${taskId}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      // Verify it's gone (soft-deleted — should 404 on GET)
      await authGet(
        app,
        `/api/tasks/${taskId}`,
        userAuth.tokens.accessToken,
      ).expect(404);
    });

    it('Should not list deleted daily tasks', async () => {
      // Create and delete a task
      const createRes = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Tarea fantasma',
          type: 'daily',
          scheduledDate: today(),
        })
        .expect(201);

      const ghostId = createRes.body.data.id;

      await authDelete(
        app,
        `/api/tasks/${ghostId}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      // Should not appear in daily list
      const listRes = await authGet(
        app,
        '/api/tasks/daily',
        userAuth.tokens.accessToken,
      ).expect(200);

      const found = listRes.body.data.find((t: any) => t.id === ghostId);
      expect(found).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Isolation Tests
  // ═══════════════════════════════════════════════════════════════════

  describe('Isolation', () => {
    it('19. Daily tasks should NOT appear in project task listings', async () => {
      // Create a daily task for today
      const dailyRes = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Isolation test - daily task',
          type: 'daily',
          scheduledDate: today(),
        })
        .expect(201);

      const dailyTaskId = dailyRes.body.data.id;

      // List tasks filtered by type=project
      const projectList = await authGet(
        app,
        '/api/tasks?type=project',
        userAuth.tokens.accessToken,
      ).expect(200);

      // The daily task should NOT be in project-type listings
      const found = projectList.body.data.find(
        (t: any) => t.id === dailyTaskId,
      );
      expect(found).toBeUndefined();
    });

    it('20. Different users should NOT see each other\'s daily tasks', async () => {
      const isolationDate = '2026-12-25';

      // User 1 creates a daily task
      const user1Task = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Tarea privada de usuario 1',
          type: 'daily',
          scheduledDate: isolationDate,
        })
        .expect(201);

      // User 2 creates a daily task for the same date
      const user2Task = await authPost(
        app,
        '/api/tasks',
        otherUserAuth.tokens.accessToken,
      )
        .send({
          title: 'Tarea privada de usuario 2',
          type: 'daily',
          scheduledDate: isolationDate,
        })
        .expect(201);

      // User 1 lists daily tasks — should see only their own
      const user1List = await authGet(
        app,
        `/api/tasks/daily?date=${isolationDate}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      const user1TaskIds = user1List.body.data.map((t: any) => t.id);
      expect(user1TaskIds).toContain(user1Task.body.data.id);
      expect(user1TaskIds).not.toContain(user2Task.body.data.id);

      // User 2 lists daily tasks — should see only their own
      const user2List = await authGet(
        app,
        `/api/tasks/daily?date=${isolationDate}`,
        otherUserAuth.tokens.accessToken,
      ).expect(200);

      const user2TaskIds = user2List.body.data.map((t: any) => t.id);
      expect(user2TaskIds).toContain(user2Task.body.data.id);
      expect(user2TaskIds).not.toContain(user1Task.body.data.id);
    });

    it('Other user should NOT be able to update my daily task', async () => {
      // User 1 creates a daily task
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Solo yo puedo editar esto',
          type: 'daily',
          scheduledDate: today(),
        })
        .expect(201);

      const taskId = res.body.data.id;

      // User 2 tries to update it — should be forbidden
      await authPatch(
        app,
        `/api/tasks/${taskId}`,
        otherUserAuth.tokens.accessToken,
      )
        .send({ title: 'Intento de hackeo' })
        .expect(403);
    });

    it('Other user should NOT be able to delete my daily task', async () => {
      // User 1 creates a daily task
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Solo yo puedo borrar esto',
          type: 'daily',
          scheduledDate: today(),
        })
        .expect(201);

      const taskId = res.body.data.id;

      // User 2 tries to delete it — should be forbidden
      await authDelete(
        app,
        `/api/tasks/${taskId}`,
        otherUserAuth.tokens.accessToken,
      ).expect(403);
    });

    it('My daily tasks endpoint should NOT include other user tasks', async () => {
      // User 2 creates a daily task
      const otherRes = await authPost(
        app,
        '/api/tasks',
        otherUserAuth.tokens.accessToken,
      )
        .send({
          title: 'Tarea del otro usuario para my-tasks',
          type: 'daily',
          scheduledDate: today(),
        })
        .expect(201);

      const otherTaskId = otherRes.body.data.id;

      // User 1 checks their "my tasks" — should NOT see user 2's task
      const myTasks = await authGet(
        app,
        '/api/tasks/my?type=daily',
        userAuth.tokens.accessToken,
      ).expect(200);

      const myTaskIds = myTasks.body.data.map((t: any) => t.id);
      expect(myTaskIds).not.toContain(otherTaskId);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Edge Cases & Additional Coverage
  // ═══════════════════════════════════════════════════════════════════

  describe('Edge Cases', () => {
    it('Should create daily task with all optional fields', async () => {
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Tarea completa',
          type: 'daily',
          description: 'Descripcion completa',
          priority: 'high',
          scheduledDate: today(),
          statusId: statusEnProgreso.id,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Tarea completa');
      expect(res.body.data.type).toBe('daily');
      expect(res.body.data.description).toBe('Descripcion completa');
      expect(res.body.data.priority).toBe('high');
      expect(res.body.data.statusId).toBe(statusEnProgreso.id);
      expect(res.body.data.projectId).toBeNull();
    });

    it('Should get daily task by ID with assignees', async () => {
      const createRes = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Tarea para GET by ID',
          type: 'daily',
          scheduledDate: today(),
        })
        .expect(201);

      const taskId = createRes.body.data.id;

      const res = await authGet(
        app,
        `/api/tasks/${taskId}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(taskId);
      expect(res.body.data.type).toBe('daily');
      expect(res.body.data.assignees).toBeDefined();
      expect(Array.isArray(res.body.data.assignees)).toBe(true);
    });

    it('Should handle completing and un-completing multiple times', async () => {
      const createRes = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Tarea toggle completa',
          type: 'daily',
          scheduledDate: today(),
        })
        .expect(201);

      const taskId = createRes.body.data.id;

      // Complete it
      const complete1 = await authPatch(
        app,
        `/api/tasks/${taskId}`,
        userAuth.tokens.accessToken,
      )
        .send({ statusId: statusCompletado.id })
        .expect(200);
      expect(complete1.body.data.completedAt).not.toBeNull();

      // Uncomplete it
      const uncomplete = await authPatch(
        app,
        `/api/tasks/${taskId}`,
        userAuth.tokens.accessToken,
      )
        .send({ statusId: statusPorHacer.id })
        .expect(200);
      expect(uncomplete.body.data.completedAt).toBeNull();

      // Complete it again
      const complete2 = await authPatch(
        app,
        `/api/tasks/${taskId}`,
        userAuth.tokens.accessToken,
      )
        .send({ statusId: statusCompletado.id })
        .expect(200);
      expect(complete2.body.data.completedAt).not.toBeNull();
    });

    it('Should reject unauthenticated access to daily tasks', async () => {
      await request(getServer(app)).get('/api/tasks/daily').expect(401);
    });

    it('Should reject unauthenticated daily task creation', async () => {
      await request(getServer(app))
        .post('/api/tasks')
        .send({
          title: 'Sin auth',
          type: 'daily',
        })
        .expect(401);
    });

    it('Should reject unknown properties in create body (forbidNonWhitelisted)', async () => {
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Tarea con campos extras',
          type: 'daily',
          scheduledDate: today(),
          hackerField: 'should fail',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('Should generate a systemCode for daily tasks', async () => {
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Tarea con systemCode',
          type: 'daily',
          scheduledDate: today(),
        })
        .expect(201);

      expect(res.body.data.systemCode).toBeDefined();
      expect(res.body.data.systemCode).toMatch(/^TSK-/);
    });

    it('Default status should be assigned when no statusId provided', async () => {
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Tarea sin status explicito',
          type: 'daily',
          scheduledDate: today(),
        })
        .expect(201);

      expect(res.body.data.statusId).toBe(statusPorHacer.id);
    });
  });
});
