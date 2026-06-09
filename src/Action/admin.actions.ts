"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { requireRole } from "@/src/Library/dal";
import {
  getSystemStats,
  getAuditLogs,
  getAllUsers,
  updateUserRoleDal,
} from "@/src/Library/dal/admin.dal";

type ActionSuccess<T> = { success: true; data: T };
type ActionError = { success: false; error: string };
type ActionResult<T> = ActionSuccess<T> | ActionError;

export async function fetchSystemStats(): Promise<ActionResult<Awaited<ReturnType<typeof getSystemStats>>>> {
  try {
    await requireRole("ADMIN");
    const data = await getSystemStats();
    return { success: true, data };
  } catch (error) {
    console.error("[fetchSystemStats] error:", error);
    return { success: false, error: "Forbidden" };
  }
}

export async function fetchAuditLogs(
  cursor?: string,
  limit: number = 50
): Promise<ActionResult<Awaited<ReturnType<typeof getAuditLogs>>>> {
  try {
    await requireRole("ADMIN");
    const data = await getAuditLogs(cursor, limit);
    return { success: true, data };
  } catch (error) {
    console.error("[fetchAuditLogs] error:", error);
    return { success: false, error: "Forbidden" };
  }
}

export async function fetchUsers(
  cursor?: string,
  limit: number = 50
): Promise<ActionResult<Awaited<ReturnType<typeof getAllUsers>>>> {
  try {
    await requireRole("ADMIN");
    const data = await getAllUsers(cursor, limit);
    return { success: true, data };
  } catch (error) {
    console.error("[fetchUsers] error:", error);
    return { success: false, error: "Forbidden" };
  }
}

export async function updateRole(
  userId: string,
  newRole: Role
): Promise<ActionResult<Awaited<ReturnType<typeof updateUserRoleDal>>>> {
  try {
    await requireRole("ADMIN");
    const data = await updateUserRoleDal(userId, newRole);
    revalidatePath("/admin/dashboard", "layout");
    revalidatePath("/admin/logs", "layout");
    revalidatePath("/admin/users", "layout");
    return { success: true, data };
  } catch (error) {
    console.error("[updateRole] error:", error);
    return { success: false, error: "Forbidden" };
  }
}
