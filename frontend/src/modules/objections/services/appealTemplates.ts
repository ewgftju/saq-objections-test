import type { ObjectionCase } from "../../../types";
import { formatDate } from "../../../utils/dateFormat";
import { auditAuthorityFullName } from "../../../utils/auditAuthority";

function value(text?: string) {
  return text?.trim() || "—";
}

function withPeriod(text: string) {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function inlineValue(text?: string) {
  return value(text).replace(/[.]+$/, "");
}

function applicantReference(c: ObjectionCase) {
  return `${value(c.org)}, ИИН/БИН ${value(c.bin)}, № ${value(c.appealNumber)} от ${formatDate(c.appealDate || c.filed)} года`;
}

function prescriptionAuditReference(c: ObjectionCase) {
  const details = c.agendaDetails;
  return `${applicantReference(c)}, на предписание от ${formatDate(details?.relatedDocumentDate)} года № ${value(details?.relatedDocumentNumber)} по аудиторскому отчету, проведенный ${auditAuthorityFullName(c.issuer)}`;
}

function statementReference(c: ObjectionCase) {
  return `${applicantReference(c)} ${inlineValue(c.request)}`;
}

function isPrescriptionAuditComplaint(c: ObjectionCase) {
  return (
    c.appealType === "Жалоба на решение КВГА/ДВГА" &&
    ["prescription-audit", "prescription"].includes(
      c.agendaDetails?.decisionKind || "",
    )
  );
}

/** Text shared by the agenda and protocol templates for the specified appeal kinds. */
export function agendaOrProtocolIntro(c: ObjectionCase) {
  if (c.appealType === "Заявление")
    return withPeriod(`Заявление от ${statementReference(c)}`);

  if (isPrescriptionAuditComplaint(c))
    return `Жалоба от ${prescriptionAuditReference(c)}.`;

  return undefined;
}

/** Standard body of the request to КВГА/ДВГА for the specified appeal kinds. */
export function requestTemplateIntro(c: ObjectionCase) {
  if (c.appealType === "Заявление")
    return `В связи с поступлением на рассмотрение Апелляционной комиссии Министерства финансов Республики Казахстан заявления от ${statementReference(c)}, просим представить мотивированный ответ по каждому доводу возражения и подтверждающие документы.`;

  if (isPrescriptionAuditComplaint(c))
    return `В связи с поступлением на рассмотрение Апелляционной комиссии Министерства финансов Республики Казахстан жалобы от ${prescriptionAuditReference(c)}, просим представить мотивированный ответ по каждому доводу возражения и подтверждающие документы.`;

  return undefined;
}

/** First paragraph of the certificate for the specified appeal kinds. */
export function certificateTemplateIntro(c: ObjectionCase) {
  if (c.appealType === "Заявление")
    return withPeriod(
      `В Министерство финансов Республики Казахстан поступило заявление от ${statementReference(c)}`,
    );

  if (isPrescriptionAuditComplaint(c))
    return `В Министерство финансов Республики Казахстан поступила жалоба от ${prescriptionAuditReference(c)}.`;

  return undefined;
}
