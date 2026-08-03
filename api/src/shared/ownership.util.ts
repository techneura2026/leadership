import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@leaderprism/shared';

const DEFAULT_PRIVILEGED_ROLES: UserRole[] = [
  UserRole.ORG_ADMIN,
  UserRole.HR_MANAGER,
  UserRole.SUPER_ADMIN,
];

/**
 * True when the requesting user either owns the resource (matches `ownerId`) or holds one of
 * the privileged roles allowed to act on anyone's behalf (defaults to org admin tier).
 */
export function isOwnerOrPrivileged(
  ownerId: string,
  requestingUserId: string,
  requestingRole: UserRole,
  privilegedRoles: UserRole[] = DEFAULT_PRIVILEGED_ROLES,
): boolean {
  return ownerId === requestingUserId || privilegedRoles.includes(requestingRole);
}

/**
 * Throws 403 unless the requesting user owns the resource or holds a privileged role.
 * Centralises the ownership check pattern used across UC1-4 participant self-service
 * endpoints so "can this caller touch this participant's data" isn't reimplemented per method.
 */
export function assertOwnerOrPrivileged(
  ownerId: string,
  requestingUserId: string,
  requestingRole: UserRole,
  message = 'You do not have access to this data.',
  privilegedRoles: UserRole[] = DEFAULT_PRIVILEGED_ROLES,
): void {
  if (!isOwnerOrPrivileged(ownerId, requestingUserId, requestingRole, privilegedRoles)) {
    throw new ForbiddenException(message);
  }
}
