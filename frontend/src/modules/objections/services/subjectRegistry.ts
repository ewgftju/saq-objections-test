import type { CaseRequest, ObjectionCase, Role } from "../../../types";
import {
  hasSubjectSaqCabinet,
  isSubjectRole,
  subjectRoleForCase,
} from "./saqCabinets";

export function isApplicantCase(c: ObjectionCase, role: Role) {
  return (
    isSubjectRole(role) &&
    hasSubjectSaqCabinet(c) &&
    subjectRoleForCase(c) === role
  );
}

export function isSubjectRequest(
  c: ObjectionCase,
  request: CaseRequest,
  role: Role,
) {
  return (
    isSubjectRole(role) &&
    request.template === "other" &&
    !request.cancelled &&
    Boolean(request.sent) &&
    (request.saqRecipient === "subject"
      ? isApplicantCase(c, role)
      : request.saqRecipient === role)
  );
}

export function subjectCanOpenCase(c: ObjectionCase, role: Role) {
  return (
    isApplicantCase(c, role) ||
    c.requests.some((request) => isSubjectRequest(c, request, role)) ||
    Boolean(
      isSubjectRole(role) &&
        c.delivery?.recipientRoles?.includes(role) &&
        c.documents.some((document) => document.kind === "final-response"),
    )
  );
}

/** Статус для заявителя без внутренних этапов согласования и голосования. */
export function subjectCaseStatus(c: ObjectionCase) {
  if (c.status === "withdrawn") return "Отозвано";
  if (c.status === "refused") return "Возвращено";
  if (c.status === "completed" || c.delivery?.date) return "Рассмотрено";
  if (c.status === "forwarded") return "Направлено по компетенции";
  if (c.status === "received") return "Направлено";
  return "На рассмотрении";
}
