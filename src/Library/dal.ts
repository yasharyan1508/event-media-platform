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
  clerkId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: Role;
  isActive: boolean;
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
    select: {
      id: true,
      clerkId: true,
      email: true,
      name: true,
      avatarUrl: true,
      role: true,
      isActive: true,
    },
  });

  if (!user) {
    // ─── SELF-HEALING FALLBACK ─────────────────────────────────────
    // If the user exists in Clerk but not in our DB (e.g., local DB wiped, webhook failed),
    // redirecting to /sign-in causes an infinite loop because proxy.ts redirects back to /dashboard.
    // Instead, we fetch their details from Clerk and recreate them in the DB.
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);

      const email = clerkUser.emailAddresses[0]?.emailAddress;
      if (!email) {
        throw new Error("No email found for Clerk user");
      }

      const adminEmail = process.env.ADMIN_EMAIL;
      const role =
        adminEmail && email.toLowerCase() === adminEmail.toLowerCase()
          ? Role.ADMIN
          : Role.MEMBER;

      const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

      const newUser = await prisma.user.create({
        data: {
          clerkId: userId,
          email,
          name,
          avatarUrl: clerkUser.imageUrl || null,
          role,
        },
        select: {
          id: true,
          clerkId: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          isActive: true,
        },
      });

      // Sync role back to Clerk publicMetadata
      await client.users.updateUserMetadata(userId, {
        publicMetadata: { role: newUser.role },
      });

      console.log(`[dal.ts] Self-healed user: ${email} (role: ${newUser.role})`);
      user = newUser;
    } catch (err) {
      console.error("[dal.ts] Self-healing failed:", err);
      // Catastrophic failure fallback
      redirect("/sign-in");
    }
  }

  if (!user.isActive) {
    redirect("/account-disabled");
  }

  return user;
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
