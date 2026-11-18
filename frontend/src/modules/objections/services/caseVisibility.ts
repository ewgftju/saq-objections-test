import type { ObjectionCase, Role } from "../../../types";
import { isApplicantCase } from "./subjectRegistry";

export function awaitsDirectorAssignment(c: ObjectionCase): boolean {
  return c.status === "received" && c.channel.trim().toUpperCase() === "SAQ";
}

export function caseVisibleToRole(c: ObjectionCase, role: Role): boolean {
  return (
    !awaitsDirectorAssignment(c) ||
    isApplicantCase(c, role) ||
    role === "director" ||
    role === "demo-superuser"
  );
}
