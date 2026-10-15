import type { ObjectionCase, Role } from "../../../types";

/**
 * Демонстрационный реестр кабинетов заявителей SAQ.
 * В промышленной версии список должен поступать из сервиса учётных записей
 * SAQ по БИН/ИИН, а не определяться по каналу поступления обращения.
 */
const SUBJECT_SAQ_CABINET_IDENTIFIERS = new Set([
  "111111111111",
  "000000000002",
  "000000000003",
  "001002003004",
]);

const SUBJECT_2_IDENTIFIER = "001002003004";

export function isSubjectRole(role: Role) {
  return role === "subject" || role === "subject2";
}

/** Определяет кабинет заявителя по его БИН/ИИН. */
export function subjectRoleForCase(c: Pick<ObjectionCase, "bin">): "subject" | "subject2" {
  return (c.bin || "").replace(/\D/g, "") === SUBJECT_2_IDENTIFIER
    ? "subject2"
    : "subject";
}

export function subjectCabinetName(c: Pick<ObjectionCase, "bin">) {
  return subjectRoleForCase(c) === "subject2" ? "Объект №2" : "Объект";
}

export function hasSubjectSaqCabinet(c: Pick<ObjectionCase, "bin">) {
  return SUBJECT_SAQ_CABINET_IDENTIFIERS.has((c.bin || "").replace(/\D/g, ""));
}

export function subjectSaqCabinetLabel(c: Pick<ObjectionCase, "bin" | "applicantIdentifierType">) {
  const identifierType = c.applicantIdentifierType || "БИН";
  const identifier = c.bin || "не указан";
  return hasSubjectSaqCabinet(c)
    ? `Кабинет заявителя SAQ доступен (${identifierType}: ${identifier}).`
    : `Кабинет заявителя SAQ не зарегистрирован (${identifierType}: ${identifier}).`;
}
