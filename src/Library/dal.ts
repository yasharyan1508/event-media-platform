import "server-only";

import { cache } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { hasPermission, isRoleAtLeast } from "./rbac";
import { Permission } from "../Constants/permissions";
import { ROLE_LEVELS } from "../Constants/roles";

export type AuthUser = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  role: Role;
};

/**
 * Get the current authenticated user from the database.
 * Cached per request via React.cache() — safe to call multiple times in one render.
 *
 * Redirects to /sign-in if unauthenticated.
 * Redirects to /account-disabled if the user is deactivated.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser> => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  let user = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  if (!user) {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      throw new Error("Clerk user has no email address");
    }

    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

    user = await prisma.user.create({
      data: {
        clerkId: userId,
        email,
        name,
        avatarUrl: clerkUser.imageUrl || null,
        role: Role.MEMBER,
      },
    });

    await client.users.updateUserMetadata(userId, {
      publicMetadata: { role: Role.MEMBER },
    });
  }

  if (!user.isActive) {
    redirect("/account-disabled");
  }

  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
  };
});

/**
 * Require a minimum role level. Throws 403 if insufficient.
 */
export async function requireRole(minimumRole: Role): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!isRoleAtLeast(user.role, minimumRole)) {
    throw new Error(
      `Forbidden: requires ${minimumRole}, user has ${user.role}`
    );
  }

  return user;
}

/**
 * Require a specific permission. Throws 403 if insufficient.
 */
export async function requirePermission(
  permission: Permission
): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!hasPermission(user.role, permission)) {
    throw new Error(
      `Forbidden: requires permission ${permission}, user role ${user.role} does not have it`
    );
  }

  return user;
}

/**
 * Require ownership of an entity. ADMIN bypasses.
 */
export async function requireOwnership(
  ownerId: string
): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (user.role !== Role.ADMIN && user.id !== ownerId) {
    throw new Error("Forbidden: you do not own this resource");
  }

  return user;
}
