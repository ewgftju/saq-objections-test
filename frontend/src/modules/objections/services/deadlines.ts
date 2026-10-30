import type { ObjectionCase, Role } from "../../../types";
import { authorityStatusRequest } from "./statusPresentation";
export const holidays = ["2026-08-31", "2026-10-26", "2026-12-16"];
export function dateObject(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || ""))
    throw Error("Укажите корректную дату");
  const d = new Date(s + "T12:00:00Z");
  if (!Number.isFinite(d.valueOf()) || d.toISOString().slice(0, 10) !== s)
    throw Error("Укажите корректную дату");
  return d;
}
export function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
export function isWorkday(s: string) {
  const d = dateObject(s);
  return ![0, 6].includes(d.getUTCDay()) && !holidays.includes(s);
}
export function addWorkdays(s: string, n: number) {
  const d = dateObject(s);
  if (n < 0 || !Number.isInteger(n)) throw Error("Неверный срок");
  let left = n;
  while (left) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isWorkday(iso(d))) left--;
  }
  return iso(d);
}
export function subtractWorkdays(s: string, n: number) {
  const d = dateObject(s);
  if (n < 0 || !Number.isInteger(n)) throw Error("Неверный срок");
  let left = n;
  while (left) {
    d.setUTCDate(d.getUTCDate() - 1);
    if (isWorkday(iso(d))) left--;
  }
  return iso(d);
}
export function workdaysBetween(a: string, b: string): number {
  if (b < a) return -workdaysBetween(b, a);
  let n = 0;
  const d = dateObject(a);
  while (iso(d) < b) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isWorkday(iso(d))) n++;
  }
  return n;
}
export function addMonths(s: string, n: number) {
  const d = dateObject(s),
    day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const limit = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, limit));
  while (!isWorkday(iso(d))) d.setUTCDate(d.getUTCDate() + 1);
  return iso(d);
}
export function filingDeadline(c: ObjectionCase) {
  return c.type === "control"
    ? addMonths(
        c.document.received,
        c.document.appealExplained === false ? 6 : 3,
      )
    : addWorkdays(c.document.received, c.type === "audit" ? 10 : 5);
}

export function reviewDuration(c: ObjectionCase) {
  if (c.appealType === "Возражение на аудиторский отчет") return 30;
  if (
    [
      "Жалоба на уведомление",
      "Жалоба на решение КВГА/ДВГА",
      "Жалоба на действие/бездействие",
    ].includes(c.appealType || "")
  )
    return 20;
  if (
    [
      "Возражение на уведомление",
      "Возражение на уведомления",
      "Заявление",
    ].includes(c.appealType || "") ||
    c.type === "notice"
  )
    return 15;
  return 30;
}

export function hearingExtensionApplies(c: ObjectionCase) {
  const kind = (c.appealType || "").trim();
  return ["Возражение на уведомление", "Возражение на уведомления", "Возражение на аудиторский отчет", "Возражение на аудиторский отчёт"].includes(kind) || (!kind && (c.type === "notice" || c.type === "audit"));
}

export function reviewPauseDays(c: ObjectionCase) {
  return c.appealType?.trim().startsWith("Жалоба") ? 0 : c.pauseDays;
}

export function reviewDeadline(c: ObjectionCase) {
  let d = addWorkdays(c.document.received, reviewDuration(c));
  if (c.extensionDays) d = addWorkdays(d, c.extensionDays);
  if (reviewPauseDays(c)) d = addWorkdays(d, reviewPauseDays(c));
  return d;
}

/** Deadline for the action currently assigned at a process stage. */
function authorityResponseDeadline(c: ObjectionCase, role?: Role) {
  const authority = role === "kvga" ? "КВГА" : role === "dvga" ? "ДВГА" : "";
  return c.requests
    .filter(
      (request) =>
        Boolean(request.sent) &&
        /ДВГА|КВГА/i.test(request.recipient) &&
        (!c.newArgumentsReceivedAt || (request.sent! >= c.newArgumentsReceivedAt && !request.confirmed)) &&
        (!authority || request.recipient.toUpperCase().includes(authority)),
    )
    .map((request) => addWorkdays(request.sent!, 2))
    .sort()[0];
}

/**
 * Срок формирования справки считается от даты поступления обращения. Для
 * возражений период ожидания ответа на направленный запрос не включается в
 * эти пять рабочих дней: после фиксации ответа накопленное количество дней
 * хранится в pauseDays и добавляется к исходному сроку.
 */
function certificateDeadline(c: ObjectionCase) {
  if (c.newArgumentsReceivedAt) return addWorkdays(c.newArgumentsReceivedAt, 5 + Math.max(0, reviewPauseDays(c) - (c.newArgumentsPauseDaysAtReceipt || 0)));
  return addWorkdays(c.document.received, 5 + reviewPauseDays(c));
}

export function executionDeadline(
  c: ObjectionCase,
  role?: Role,
): string | null {
  if (role === "commission") {
    // Члены АК видят срок только своих действий: ознакомления, голосования
    // и подписания протокола. Сроки рабочего органа им не показываются.
    return ["documents_review", "commission_voting", "protocol"].includes(
      c.status,
    )
      ? executionDeadline(c)
      : null;
  }
  if (role === "dvga" || role === "kvga") {
    const request = authorityStatusRequest(c, role);
    return request?.sent && !request.responseSigned
      ? addWorkdays(request.sent, 2)
      : null;
  }
  if (c.status === "received") return c.document.received;
  if (
    ["accepted", "requested", "request_approval", "request_signed"].includes(
      c.status,
    )
  )
    return addWorkdays(c.newArgumentsReceivedAt || c.document.received, 2);
  if (
    [
      "request_approved",
      "response_approval",
      "response_signed",
      "response_ready",
    ].includes(c.status)
  ) {
    return authorityResponseDeadline(c) ?? addWorkdays(c.newArgumentsReceivedAt || c.document.received, 2);
  }
  if (
    ["materials", "certificate_approval", "certificate_signed"].includes(
      c.status,
    )
  )
    return certificateDeadline(c);
  if (
    [
      "certificate_approved",
      "documents_review",
      "commission_members",
      "commission_voting",
      "circulated",
      "meeting_certificate_approval",
      "meeting_certificate_signed",
      "meeting_certificate_approved",
    ].includes(c.status)
  )
    return c.attendanceMeetingDate ?? c.agendaMeetingDate ?? null;
  if (c.status === "meeting") {
    const meetingDate =
      c.attendanceMeetingDate ?? c.agendaMeetingDate ?? c.hearing?.date;
    return meetingDate ? addWorkdays(meetingDate, 1) : null;
  }
  if (c.status === "protocol") {
    // После формирования проект протокола передаётся членам комиссии на
    // подписание. Срок подписи считается от даты получения проекта, а не от
    // даты заседания. Для старых карточек без projectReceived сохраняем
    // совместимость, используя дату заседания как резервное значение.
    const protocolReceivedDate =
      c.meeting?.projectReceived ??
      c.meeting?.date ??
      c.attendanceMeetingDate ??
      c.agendaMeetingDate;
    return protocolReceivedDate ? addWorkdays(protocolReceivedDate, 1) : null;
  }
  if (
    [
      "decision_project",
      "decision_project_approval",
      "decision_project_signed",
      "decision_project_delivery",
      "decision_project_comments",
      "decision_project_hearing",
    ].includes(c.status)
  )
    return subtractWorkdays(reviewDeadline(c), 3);
  if (
    [
      "decided",
      "final_response_approval",
      "final_response_signed",
      "final_response_delivery",
    ].includes(c.status)
  )
    return reviewDeadline(c);
  return null;
}
