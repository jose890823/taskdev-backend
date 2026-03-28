/**
 * Tasks Module — E2E Test Suite
 *
 * Comprehensive tests for task CRUD, filtering, subtasks, comments,
 * status transitions, priority/assignment, bulk operations, and access control.
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

describe('Tasks (e2e)', () => {
  let app: INestApplication;
  let userAuth: AuthenticatedUser;
  let user2Auth: AuthenticatedUser;
  let outsiderAuth: AuthenticatedUser;
  let projectId: string;
  let statuses: {
    id: string;
    name: string;
    isDefault: boolean;
    isCompleted: boolean;
  }[];

  // Helper to find status by name
  const getStatus = (name: string) => {
    const s = statuses.find((st) => st.name === name);
    if (!s) throw new Error(`Status "${name}" not found`);
    return s;
  };

  beforeAll(async () => {
    app = await createE2EApp();
    userAuth = await createTestUser(app);
    user2Auth = await createTestUser(app);
    outsiderAuth = await createTestUser(app);

    // Create a project owned by userAuth
    const projectRes = await authPost(
      app,
      '/api/projects',
      userAuth.tokens.accessToken,
    )
      .send({ name: 'E2E Tasks Project' })
      .expect(201);
    projectId = projectRes.body.data.id;

    // Add user2 as project member
    await authPost(
      app,
      `/api/projects/${projectId}/members`,
      userAuth.tokens.accessToken,
    )
      .send({ userId: user2Auth.user.id, role: 'member' })
      .expect(201);

    // Get auto-created statuses for the project
    const statusRes = await authGet(
      app,
      `/api/projects/${projectId}/statuses`,
      userAuth.tokens.accessToken,
    ).expect(200);
    statuses = statusRes.body.data;
  }, 60000);

  afterAll(async () => {
    await cleanupTestData();
    await closeE2EApp();
  });

  // ─── Task CRUD ──────────────────────────────────────────────────

  describe('Task CRUD', () => {
    let taskId: string;

    it('1. Should create a project task (201)', async () => {
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'E2E Task One',
          projectId,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.title).toBe('E2E Task One');
      expect(res.body.data.projectId).toBe(projectId);
      expect(res.body.data.type).toBe('project');
      expect(res.body.data.priority).toBe('medium');
      expect(res.body.data.createdById).toBe(userAuth.user.id);
      // Should auto-assign the default status
      expect(res.body.data.statusId).toBeDefined();
      taskId = res.body.data.id;
    });

    it('2. Should create task with all optional fields', async () => {
      const defaultStatus = getStatus('Por hacer');
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Fully-loaded Task',
          description: 'A detailed description for this task',
          type: 'project',
          projectId,
          statusId: defaultStatus.id,
          assignedToId: user2Auth.user.id,
          priority: 'high',
          scheduledDate: '2026-04-01',
          dueDate: '2026-04-15',
        })
        .expect(201);

      expect(res.body.data.title).toBe('Fully-loaded Task');
      expect(res.body.data.description).toBe(
        'A detailed description for this task',
      );
      expect(res.body.data.type).toBe('project');
      expect(res.body.data.priority).toBe('high');
      expect(res.body.data.assignedToId).toBe(user2Auth.user.id);
      expect(res.body.data.statusId).toBe(defaultStatus.id);
    });

    it('3. Should reject task without title (400)', async () => {
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({ projectId })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('4. Should list tasks for project', async () => {
      const res = await authGet(
        app,
        `/api/tasks?projectId=${projectId}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      // All tasks should belong to this project
      for (const task of res.body.data) {
        expect(task.projectId).toBe(projectId);
      }
    });

    it('5. Should list tasks with pagination', async () => {
      const res = await authGet(
        app,
        `/api/tasks?projectId=${projectId}&page=1&limit=1`,
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.data.length).toBe(1);
    });

    it('6. Should get task by ID', async () => {
      const res = await authGet(
        app,
        `/api/tasks/${taskId}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(taskId);
      expect(res.body.data.title).toBe('E2E Task One');
      // Should include assignees array
      expect(Array.isArray(res.body.data.assignees)).toBe(true);
    });

    it('7. Should update task title', async () => {
      const res = await authPatch(
        app,
        `/api/tasks/${taskId}`,
        userAuth.tokens.accessToken,
      )
        .send({ title: 'E2E Task One — Updated' })
        .expect(200);

      expect(res.body.data.title).toBe('E2E Task One — Updated');
    });

    it('8. Should update task status to "En progreso"', async () => {
      const inProgress = getStatus('En progreso');
      const res = await authPatch(
        app,
        `/api/tasks/${taskId}`,
        userAuth.tokens.accessToken,
      )
        .send({ statusId: inProgress.id })
        .expect(200);

      expect(res.body.data.statusId).toBe(inProgress.id);
    });

    it('9. Should update task priority', async () => {
      const res = await authPatch(
        app,
        `/api/tasks/${taskId}`,
        userAuth.tokens.accessToken,
      )
        .send({ priority: 'urgent' })
        .expect(200);

      expect(res.body.data.priority).toBe('urgent');
    });

    it('10. Should assign task to another user', async () => {
      const res = await authPatch(
        app,
        `/api/tasks/${taskId}`,
        userAuth.tokens.accessToken,
      )
        .send({ assignedToIds: [user2Auth.user.id] })
        .expect(200);

      expect(res.body.data.assignees).toBeDefined();
      expect(res.body.data.assignees.length).toBe(1);
      expect(res.body.data.assignees[0].id).toBe(user2Auth.user.id);
    });

    it('11. Should delete task', async () => {
      // Create a task specifically for deletion
      const createRes = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({ title: 'Task to delete', projectId })
        .expect(201);
      const deleteId = createRes.body.data.id;

      await authDelete(
        app,
        `/api/tasks/${deleteId}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      // Verify it's gone (soft-deleted)
      await authGet(
        app,
        `/api/tasks/${deleteId}`,
        userAuth.tokens.accessToken,
      ).expect(404);
    });

    it('12. Should reject operations without auth (401)', async () => {
      const server = getServer(app);
      await request(server).get('/api/tasks').expect(401);
      await request(server)
        .post('/api/tasks')
        .send({ title: 'No Auth' })
        .expect(401);
      await request(server).get(`/api/tasks/${taskId}`).expect(401);
      await request(server)
        .patch(`/api/tasks/${taskId}`)
        .send({ title: 'x' })
        .expect(401);
      await request(server).delete(`/api/tasks/${taskId}`).expect(401);
    });
  });

  // ─── Task Filtering ─────────────────────────────────────────────

  describe('Task Filtering', () => {
    let filteredTaskId: string;

    beforeAll(async () => {
      // Create a task assigned to user2 with a specific status for filtering
      const inProgress = getStatus('En progreso');
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Filterable Task',
          projectId,
          statusId: inProgress.id,
          assignedToIds: [user2Auth.user.id],
        })
        .expect(201);
      filteredTaskId = res.body.data.id;
    });

    it('13. Should filter tasks by projectId', async () => {
      const res = await authGet(
        app,
        `/api/tasks?projectId=${projectId}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      for (const task of res.body.data) {
        expect(task.projectId).toBe(projectId);
      }
    });

    it('14. Should filter tasks by statusId', async () => {
      const inProgress = getStatus('En progreso');
      const res = await authGet(
        app,
        `/api/tasks?projectId=${projectId}&statusId=${inProgress.id}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      for (const task of res.body.data) {
        expect(task.statusId).toBe(inProgress.id);
      }
    });

    it('15. Should filter tasks by assignedToId', async () => {
      const res = await authGet(
        app,
        `/api/tasks?projectId=${projectId}&assignedToId=${user2Auth.user.id}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      // Each task should have user2 in assignees
      for (const task of res.body.data) {
        const hasUser2 =
          task.assignees?.some(
            (a: { id: string }) => a.id === user2Auth.user.id,
          ) ||
          task.assignedToId === user2Auth.user.id ||
          task.assignedTo?.id === user2Auth.user.id;
        expect(hasUser2).toBe(true);
      }
    });

    it('16. Should get my tasks (GET /api/tasks/my)', async () => {
      const res = await authGet(
        app,
        '/api/tasks/my',
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      // userAuth created several tasks, so should have results
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  // ─── Subtasks ───────────────────────────────────────────────────

  describe('Subtasks', () => {
    let parentTaskId: string;
    let subtaskId: string;

    beforeAll(async () => {
      // Create a parent task
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({ title: 'Parent Task', projectId })
        .expect(201);
      parentTaskId = res.body.data.id;
    });

    it('17. Should create a subtask', async () => {
      const res = await authPost(
        app,
        `/api/tasks/${parentTaskId}/subtasks`,
        userAuth.tokens.accessToken,
      )
        .send({ title: 'Subtask One' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Subtask One');
      expect(res.body.data.parentId).toBe(parentTaskId);
      subtaskId = res.body.data.id;
    });

    it('18. Should list subtasks of a task', async () => {
      const res = await authGet(
        app,
        `/api/tasks/${parentTaskId}/subtasks`,
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].parentId).toBe(parentTaskId);
    });

    it('19. Should create nested subtask (subtask of subtask)', async () => {
      const res = await authPost(
        app,
        `/api/tasks/${subtaskId}/subtasks`,
        userAuth.tokens.accessToken,
      )
        .send({ title: 'Nested Subtask' })
        .expect(201);

      expect(res.body.data.parentId).toBe(subtaskId);
      expect(res.body.data.title).toBe('Nested Subtask');
    });

    it('20. Subtask should inherit projectId from parent', async () => {
      // Create subtask WITHOUT specifying projectId
      const res = await authPost(
        app,
        `/api/tasks/${parentTaskId}/subtasks`,
        userAuth.tokens.accessToken,
      )
        .send({ title: 'Inheriting Subtask' })
        .expect(201);

      expect(res.body.data.projectId).toBe(projectId);
    });
  });

  // ─── Comments ───────────────────────────────────────────────────

  describe('Comments', () => {
    let commentTaskId: string;
    let commentId: string;
    let user2CommentId: string;

    beforeAll(async () => {
      // Create a task for comments
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({ title: 'Comment Target Task', projectId })
        .expect(201);
      commentTaskId = res.body.data.id;
    });

    it('21. Should create comment on task', async () => {
      const res = await authPost(
        app,
        '/api/comments',
        userAuth.tokens.accessToken,
      )
        .send({
          taskId: commentTaskId,
          content: 'This is a test comment',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe('This is a test comment');
      expect(res.body.data.taskId).toBe(commentTaskId);
      expect(res.body.data.userId).toBe(userAuth.user.id);
      commentId = res.body.data.id;
    });

    it('22. Should list comments for task', async () => {
      const res = await authGet(
        app,
        `/api/comments/task/${commentTaskId}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].content).toBe('This is a test comment');
      expect(res.body.data[0].author).toBeDefined();
      expect(res.body.data[0].author.id).toBe(userAuth.user.id);
    });

    it('23. Should update own comment', async () => {
      const res = await authPatch(
        app,
        `/api/comments/${commentId}`,
        userAuth.tokens.accessToken,
      )
        .send({ content: 'Updated comment content' })
        .expect(200);

      expect(res.body.data.content).toBe('Updated comment content');
    });

    it('24. Should delete own comment', async () => {
      // Create a new comment for deletion
      const createRes = await authPost(
        app,
        '/api/comments',
        userAuth.tokens.accessToken,
      )
        .send({ taskId: commentTaskId, content: 'Disposable comment' })
        .expect(201);
      const disposableId = createRes.body.data.id;

      await authDelete(
        app,
        `/api/comments/${disposableId}`,
        userAuth.tokens.accessToken,
      ).expect(200);
    });

    it('25. Should reject updating other user\'s comment (403)', async () => {
      // user2 creates a comment
      const createRes = await authPost(
        app,
        '/api/comments',
        user2Auth.tokens.accessToken,
      )
        .send({ taskId: commentTaskId, content: 'User2 comment' })
        .expect(201);
      user2CommentId = createRes.body.data.id;

      // userAuth tries to update user2's comment
      await authPatch(
        app,
        `/api/comments/${user2CommentId}`,
        userAuth.tokens.accessToken,
      )
        .send({ content: 'Hijacked!' })
        .expect(403);
    });

    it('26. Should reject deleting other user\'s comment (403)', async () => {
      // userAuth tries to delete user2's comment
      await authDelete(
        app,
        `/api/comments/${user2CommentId}`,
        userAuth.tokens.accessToken,
      ).expect(403);
    });

    it('27. Should reject comment without content (400)', async () => {
      await authPost(app, '/api/comments', userAuth.tokens.accessToken)
        .send({ taskId: commentTaskId })
        .expect(400);
    });
  });

  // ─── Status Transitions ────────────────────────────────────────

  describe('Status Transitions', () => {
    let transitionTaskId: string;

    beforeAll(async () => {
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({ title: 'Transition Task', projectId })
        .expect(201);
      transitionTaskId = res.body.data.id;
    });

    it('28. Should move task to "En progreso"', async () => {
      const inProgress = getStatus('En progreso');
      const res = await authPatch(
        app,
        `/api/tasks/${transitionTaskId}`,
        userAuth.tokens.accessToken,
      )
        .send({ statusId: inProgress.id })
        .expect(200);

      expect(res.body.data.statusId).toBe(inProgress.id);
      expect(res.body.data.completedAt).toBeNull();
    });

    it('29. Should move task to "Completado" (should set completedAt)', async () => {
      const completed = getStatus('Completado');
      const res = await authPatch(
        app,
        `/api/tasks/${transitionTaskId}`,
        userAuth.tokens.accessToken,
      )
        .send({ statusId: completed.id })
        .expect(200);

      expect(res.body.data.statusId).toBe(completed.id);
      expect(res.body.data.completedAt).not.toBeNull();
    });

    it('30. Should move task back to "Por hacer" (should clear completedAt)', async () => {
      const todo = getStatus('Por hacer');
      const res = await authPatch(
        app,
        `/api/tasks/${transitionTaskId}`,
        userAuth.tokens.accessToken,
      )
        .send({ statusId: todo.id })
        .expect(200);

      expect(res.body.data.statusId).toBe(todo.id);
      expect(res.body.data.completedAt).toBeNull();
    });
  });

  // ─── Priority & Assignment ─────────────────────────────────────

  describe('Priority & Assignment', () => {
    it('31. Should create task with high priority', async () => {
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({ title: 'High Priority Task', projectId, priority: 'high' })
        .expect(201);

      expect(res.body.data.priority).toBe('high');
    });

    it('32. Should create task with urgent priority', async () => {
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({ title: 'Urgent Task', projectId, priority: 'urgent' })
        .expect(201);

      expect(res.body.data.priority).toBe('urgent');
    });

    it('33. Should unassign task (set assignedToIds to empty)', async () => {
      // Create a task assigned to user2
      const createRes = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'To Unassign',
          projectId,
          assignedToIds: [user2Auth.user.id],
        })
        .expect(201);
      const id = createRes.body.data.id;

      // Unassign by passing empty array
      const res = await authPatch(
        app,
        `/api/tasks/${id}`,
        userAuth.tokens.accessToken,
      )
        .send({ assignedToIds: [] })
        .expect(200);

      expect(res.body.data.assignees).toEqual([]);
    });
  });

  // ─── Bulk Operations ───────────────────────────────────────────

  describe('Bulk Operations', () => {
    it('34. Should update task positions (PATCH /api/tasks/bulk-positions)', async () => {
      // Create two tasks
      const task1 = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({ title: 'Bulk Task A', projectId })
        .expect(201);
      const task2 = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({ title: 'Bulk Task B', projectId })
        .expect(201);

      const res = await authPatch(
        app,
        '/api/tasks/bulk-positions',
        userAuth.tokens.accessToken,
      )
        .send({
          items: [
            { id: task1.body.data.id, position: 10 },
            { id: task2.body.data.id, position: 20 },
          ],
        })
        .expect(200);

      expect(res.body.data.updated).toBe(2);

      // Verify positions were updated
      const verify1 = await authGet(
        app,
        `/api/tasks/${task1.body.data.id}`,
        userAuth.tokens.accessToken,
      ).expect(200);
      expect(verify1.body.data.position).toBe(10);

      const verify2 = await authGet(
        app,
        `/api/tasks/${task2.body.data.id}`,
        userAuth.tokens.accessToken,
      ).expect(200);
      expect(verify2.body.data.position).toBe(20);
    });
  });

  // ─── Access Control ────────────────────────────────────────────

  describe('Access Control', () => {
    it('35. Non-project-member should not access project tasks (403)', async () => {
      // outsiderAuth is NOT a member of the project
      await authGet(
        app,
        `/api/tasks?projectId=${projectId}`,
        outsiderAuth.tokens.accessToken,
      ).expect(403);
    });

    it('36. Non-project-member should not create task in project (403)', async () => {
      await authPost(app, '/api/tasks', outsiderAuth.tokens.accessToken)
        .send({ title: 'Unauthorized Task', projectId })
        .expect(403);
    });

    it('37. Project member should be able to access project tasks', async () => {
      const res = await authGet(
        app,
        `/api/tasks?projectId=${projectId}`,
        user2Auth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('38. Non-member should not get a specific project task (403)', async () => {
      // Create a task in the project
      const createRes = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({ title: 'Protected Task', projectId })
        .expect(201);
      const protectedId = createRes.body.data.id;

      await authGet(
        app,
        `/api/tasks/${protectedId}`,
        outsiderAuth.tokens.accessToken,
      ).expect(403);
    });
  });

  // ─── Daily Tasks ───────────────────────────────────────────────

  describe('Daily Tasks', () => {
    it('39. Should create a daily task without projectId', async () => {
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Daily Standup',
          type: 'daily',
          scheduledDate: '2026-03-28',
        })
        .expect(201);

      expect(res.body.data.type).toBe('daily');
      expect(res.body.data.projectId).toBeNull();
    });

    it('40. Should get daily tasks (GET /api/tasks/daily)', async () => {
      const res = await authGet(
        app,
        '/api/tasks/daily?date=2026-03-28',
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const dailyTask = res.body.data.find(
        (t: { title: string }) => t.title === 'Daily Standup',
      );
      expect(dailyTask).toBeDefined();
    });

    it('41. Should filter my tasks by type', async () => {
      const res = await authGet(
        app,
        '/api/tasks/my?type=daily',
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      for (const task of res.body.data) {
        expect(task.type).toBe('daily');
      }
    });
  });

  // ─── Bulk Positions with Status Change ─────────────────────────

  describe('Bulk Positions with Status Change', () => {
    it('42. Should update position AND status in bulk (drag to another column)', async () => {
      const inProgress = getStatus('En progreso');
      const createRes = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({ title: 'Drag Target', projectId })
        .expect(201);
      const dragTaskId = createRes.body.data.id;

      const res = await authPatch(
        app,
        '/api/tasks/bulk-positions',
        userAuth.tokens.accessToken,
      )
        .send({
          items: [{ id: dragTaskId, position: 0, statusId: inProgress.id }],
        })
        .expect(200);

      expect(res.body.data.updated).toBe(1);

      // Verify status was also changed
      const verify = await authGet(
        app,
        `/api/tasks/${dragTaskId}`,
        userAuth.tokens.accessToken,
      ).expect(200);
      expect(verify.body.data.statusId).toBe(inProgress.id);
    });
  });

  // ─── Edge Cases & Validation ───────────────────────────────────

  describe('Edge Cases & Validation', () => {
    it('43. Should reject task with invalid priority', async () => {
      await authPost(app, '/api/tasks', userAuth.tokens.accessToken)
        .send({ title: 'Bad Priority', projectId, priority: 'super-urgent' })
        .expect(400);
    });

    it('44. Should reject task with invalid type', async () => {
      await authPost(app, '/api/tasks', userAuth.tokens.accessToken)
        .send({ title: 'Bad Type', projectId, type: 'epic' })
        .expect(400);
    });

    it('45. Should reject unknown fields (forbidNonWhitelisted)', async () => {
      await authPost(app, '/api/tasks', userAuth.tokens.accessToken)
        .send({ title: 'Extra Fields', projectId, hackerField: 'evil' })
        .expect(400);
    });

    it('46. Should return 404 for non-existent task', async () => {
      const fakeUuid = '00000000-0000-4000-8000-000000000000';
      await authGet(
        app,
        `/api/tasks/${fakeUuid}`,
        userAuth.tokens.accessToken,
      ).expect(404);
    });

    it('47. Should reject comment with missing taskId (400)', async () => {
      await authPost(app, '/api/comments', userAuth.tokens.accessToken)
        .send({ content: 'Orphan comment' })
        .expect(400);
    });
  });

  // ─── Multi-assignee support ────────────────────────────────────

  describe('Multi-assignee Support', () => {
    it('48. Should create task with multiple assignees', async () => {
      const res = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Multi-assignee Task',
          projectId,
          assignedToIds: [userAuth.user.id, user2Auth.user.id],
        })
        .expect(201);

      // Verify both assignees are present by fetching the task
      const detail = await authGet(
        app,
        `/api/tasks/${res.body.data.id}`,
        userAuth.tokens.accessToken,
      ).expect(200);

      expect(detail.body.data.assignees.length).toBe(2);
      const assigneeIds = detail.body.data.assignees.map(
        (a: { id: string }) => a.id,
      );
      expect(assigneeIds).toContain(userAuth.user.id);
      expect(assigneeIds).toContain(user2Auth.user.id);
    });

    it('49. Should update task assignees to a different set', async () => {
      const createRes = await authPost(
        app,
        '/api/tasks',
        userAuth.tokens.accessToken,
      )
        .send({
          title: 'Reassign Task',
          projectId,
          assignedToIds: [userAuth.user.id],
        })
        .expect(201);

      // Reassign to only user2
      const res = await authPatch(
        app,
        `/api/tasks/${createRes.body.data.id}`,
        userAuth.tokens.accessToken,
      )
        .send({ assignedToIds: [user2Auth.user.id] })
        .expect(200);

      expect(res.body.data.assignees.length).toBe(1);
      expect(res.body.data.assignees[0].id).toBe(user2Auth.user.id);
    });
  });

  // ─── Super Admin Access ────────────────────────────────────────

  describe('Super Admin Access', () => {
    let superAdminAuth: AuthenticatedUser;

    beforeAll(async () => {
      superAdminAuth = await loginAsSuperAdmin(app);
    });

    it('50. Super admin should access any project tasks', async () => {
      const res = await authGet(
        app,
        `/api/tasks?projectId=${projectId}`,
        superAdminAuth.tokens.accessToken,
      ).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('51. Super admin should create task in any project', async () => {
      const res = await authPost(
        app,
        '/api/tasks',
        superAdminAuth.tokens.accessToken,
      )
        .send({ title: 'Admin Created Task', projectId })
        .expect(201);

      expect(res.body.data.title).toBe('Admin Created Task');
    });
  });
});
