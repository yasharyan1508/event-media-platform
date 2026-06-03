import { Role } from "@prisma/client";

export const ROLE_LEVELS: Record<Role, number> = {
  [Role.ADMIN]: 4,
  [Role.PHOTOGRAPHER]: 3,
  [Role.MEMBER]: 2,
  [Role.VIEWER]: 1,
};

export const ROLE_LABELS: Record<Role, string> = {
  [Role.ADMIN]: "Administrator",
  [Role.PHOTOGRAPHER]: "Photographer",
  [Role.MEMBER]: "Member",
  [Role.VIEWER]: "Viewer",
};
