import { ProjectRole } from '../../modules/projects/entities/project-member.entity';

const WRITE_ROLES = [ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER];
const ADMIN_ROLES = [ProjectRole.OWNER, ProjectRole.ADMIN];

export function canCreateTask(role: ProjectRole | null): boolean {
  return role !== null && WRITE_ROLES.includes(role);
}

export function canEditTask(role: ProjectRole | null, isCreator: boolean): boolean {
  if (role !== null && ADMIN_ROLES.includes(role)) return true;
  return isCreator && role !== null && WRITE_ROLES.includes(role);
}

export function canDeleteTask(role: ProjectRole | null): boolean {
  return role !== null && ADMIN_ROLES.includes(role);
}

export function canAssignTask(role: ProjectRole | null): boolean {
  return role !== null && WRITE_ROLES.includes(role);
}
