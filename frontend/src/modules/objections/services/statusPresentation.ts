import { STATUS } from "../../../data/constants";
import type { CaseRequest, CaseStatus, ObjectionCase, Role } from "../../../types";

/** Членам АК показываем только статусы, относящиеся к их работе с делом. */
const COMMISSION_STATUS: Partial<Record<CaseStatus, string>> = {
  documents_review: "Ознакомление с документами",
  commission_voting: "Голосование",
  circulated: "Голосование",
  meeting_certificate_approval: "Голосование",
  meeting_certificate_signed: "Голосование",
  meeting_certificate_approved: "Голосование",
  meeting: "Формирование протокола",
  protocol: "Подписание протокола",
};

export function statusLabelForRole(status: CaseStatus, role: Role) {
  if (role === "commission") return COMMISSION_STATUS[status];
  // Статус обращения относится к рабочему органу. Адресат запроса получает
  // статус своей работы из конкретного запроса, а не из статуса обращения.
  if (role === "dvga" || role === "kvga") return undefined;
  return STATUS[status];
}

export function isRequestForAuthority(request: CaseRequest, role: Role) {
  if (
    (role !== "dvga" && role !== "kvga") ||
    request.template === "other" ||
    request.cancelled ||
    !request.sent
  )
    return false;
  const recipient = request.recipient.toUpperCase();
  return role === "kvga"
    ? recipient.includes("КВГА")
    : recipient.includes("ДВГА") && !recipient.includes("КВГА");
}

export function authorityRequestStatusLabel(request: CaseRequest) {
  if (request.responseSigned) return "Ответ направлен";
  if (request.responseApproved) return "Подписание ответа";
  if (request.responded) return "Согласование ответа";
  return "Подготовка ответа на запрос";
}

/** Сначала показываем следующую задачу адресата, затем последний ответ. */
export function authorityStatusRequest(c: ObjectionCase, role: Role) {
  const requests = c.requests.filter((request) =>
    isRequestForAuthority(request, role),
  );
  return (
    requests.find((request) => !request.responded) ||
    requests.find((request) => !request.responseApproved) ||
    requests.find((request) => !request.responseSigned) ||
    requests.at(-1)
  );
}

export function hasBeenConsideredAtMeeting(c: ObjectionCase): boolean {
  return c.history.some(
    (event) => event.title === "Заседание по данному делу проведено",
  );
}

export function caseStatusLabelForRole(c: ObjectionCase, role: Role) {
  if (role === "dvga" || role === "kvga") {
    const request = authorityStatusRequest(c, role);
    return request ? authorityRequestStatusLabel(request) : undefined;
  }
  if (role === "commission" && hasBeenConsideredAtMeeting(c)) {
    return "Рассмотрено на заседании";
  }
  return statusLabelForRole(c.status, role);
}
