import type { ObjectionCase, Role } from "../../../types";

export function awaitsDirectorAssignment(c: ObjectionCase): boolean {
  return c.status === "received" && c.channel.trim().toUpperCase() === "SAQ";
}

export function caseVisibleToRole(c: ObjectionCase, role: Role): boolean {
  return (
    !awaitsDirectorAssignment(c) ||
    role === "director" ||
    role === "demo-superuser"
  );
}
