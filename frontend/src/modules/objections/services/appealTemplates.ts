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

function decisionComplaintReference(c: ObjectionCase) {
  if (c.appealType !== "Жалоба на решение КВГА/ДВГА") return undefined;

  const kind = c.agendaDetails?.decisionKind;
  const document = `от ${formatDate(c.document.date)} года № ${value(c.document.number)}, проведенный ${auditAuthorityFullName(c.issuer)}`;

  if (["prescription-audit", "prescription"].includes(kind || ""))
    return prescriptionAuditReference(c);

  if (kind === "prescription-preventive")
    return `${applicantReference(c)}, на предписание по акту о результате профилактического контроля ${document}`;

  if (kind === "preventive-control-act")
    return `${applicantReference(c)}, на акт о результате профилактического контроля ${document}`;

  if (kind === "quality-control")
    return `${applicantReference(c)}, на решение по результатам контроля качества ${document}`;

  if (kind === "administrative-act")
    return `${applicantReference(c)}, на административный акт ${document}`;

  return undefined;
}

function statementReference(c: ObjectionCase) {
  return `${applicantReference(c)} ${inlineValue(c.request)}`;
}

/** Text shared by the agenda and protocol templates for the specified appeal kinds. */
export function agendaOrProtocolIntro(c: ObjectionCase) {
  if (c.appealType === "Заявление")
    return withPeriod(`Заявление от ${statementReference(c)}`);

  const complaintReference = decisionComplaintReference(c);
  if (complaintReference) return `Жалоба от ${complaintReference}.`;

  return undefined;
}

/** Standard body of the request to КВГА/ДВГА for the specified appeal kinds. */
export function requestTemplateIntro(c: ObjectionCase) {
  if (c.appealType === "Заявление")
    return `В связи с поступлением на рассмотрение Апелляционной комиссии Министерства финансов Республики Казахстан заявления от ${statementReference(c)}, просим представить мотивированный ответ по каждому доводу возражения и подтверждающие документы.`;

  const complaintReference = decisionComplaintReference(c);
  if (complaintReference)
    return `В связи с поступлением на рассмотрение Апелляционной комиссии Министерства финансов Республики Казахстан жалобы от ${complaintReference}, просим представить мотивированный ответ по каждому доводу возражения и подтверждающие документы.`;

  return undefined;
}

/** First paragraph of the certificate for the specified appeal kinds. */
export function certificateTemplateIntro(c: ObjectionCase) {
  if (c.appealType === "Заявление")
    return withPeriod(
      `В Министерство финансов Республики Казахстан поступило заявление от ${statementReference(c)}`,
    );

  const complaintReference = decisionComplaintReference(c);
  if (complaintReference)
    return `В Министерство финансов Республики Казахстан поступила жалоба от ${complaintReference}.`;

  return undefined;
}
