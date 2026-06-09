"use client";

import { useTransition } from "react";
import { Role } from "@prisma/client";
import { updateRole } from "@/src/Action/admin.actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/Components/UI/select";
import { toast } from "sonner";

interface RoleSelectProps {
  userId: string;
  currentRole: Role;
}

export function RoleSelect({ userId, currentRole }: RoleSelectProps) {
  const [isPending, startTransition] = useTransition();

  const handleRoleChange = (newRole: Role) => {
    startTransition(async () => {
      const result = await updateRole(userId, newRole);
      if (result.success) {
        toast.success(`Role updated successfully to ${newRole}`);
      } else {
        toast.error(`Failed to update role: ${result.error}`);
      }
    });
  };

  return (
    <Select
      defaultValue={currentRole}
      onValueChange={(value) => handleRoleChange(value as Role)}
      disabled={isPending}
    >
      <SelectTrigger className="w-36">
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={Role.ADMIN}>Admin</SelectItem>
        <SelectItem value={Role.PHOTOGRAPHER}>Photographer</SelectItem>
        <SelectItem value={Role.MEMBER}>Member</SelectItem>
        <SelectItem value={Role.VIEWER}>Viewer</SelectItem>
      </SelectContent>
    </Select>
  );
}
