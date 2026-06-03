import { Role, EventCollaborator, CollaboratorRole } from "@prisma/client";
import { Permission, ROLE_PERMISSIONS } from "../Constants/permissions";
import { ROLE_LEVELS } from "../Constants/roles";

/**
 * Pure function to check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Pure function to compare role hierarchy levels
 */
export function isRoleAtLeast(role: Role, minimumRole: Role): boolean {
  return ROLE_LEVELS[role] >= ROLE_LEVELS[minimumRole];
}

/**
 * Check if the user is the owner of an entity
 */
export function checkOwnership(userId: string, ownerId: string, role?: Role): boolean {
  if (role === Role.ADMIN) return true;
  return userId === ownerId;
}

/**
 * Types of access a user can have to an event
 */
export enum EventAccessLevel {
  FULL_ACCESS = "FULL_ACCESS",               // ADMIN
  OWNER_ACCESS = "OWNER_ACCESS",             // Owner
  COLLABORATOR_EDIT = "COLLABORATOR_EDIT",   // Accepted collaborator with EDITOR role
  COLLABORATOR_VIEW = "COLLABORATOR_VIEW",   // Accepted collaborator with VIEWER role
  NO_ACCESS = "NO_ACCESS"                    // No access
}

/**
 * Determine a user's access level to a specific event based on ownership and collaboration
 */
export function resolveEventAccess(
  userId: string,
  role: Role,
  eventOwnerId: string,
  collaborationRecord?: EventCollaborator | null
): EventAccessLevel {
  if (role === Role.ADMIN) {
    return EventAccessLevel.FULL_ACCESS;
  }

  if (userId === eventOwnerId) {
    return EventAccessLevel.OWNER_ACCESS;
  }

  if (collaborationRecord && collaborationRecord.acceptedAt && !collaborationRecord.revokedAt) {
    return collaborationRecord.role === CollaboratorRole.EDITOR 
      ? EventAccessLevel.COLLABORATOR_EDIT 
      : EventAccessLevel.COLLABORATOR_VIEW;
  }

  return EventAccessLevel.NO_ACCESS;
}
