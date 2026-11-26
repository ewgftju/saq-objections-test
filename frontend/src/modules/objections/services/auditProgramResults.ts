import type { AuditProgramResult, AuditReportPoint, DocumentLanguage, SubjectAuditReport, ViolationPoint } from "../../../types";

type ReportPoint = SubjectAuditReport["points"][number];

export function reportPointTitle(point: ReportPoint, language: DocumentLanguage): string {
  const localized = language === "kk" ? point.titleKk : point.titleRu;
  return localized || auditReportPointText(point.auditReportPoint, "name", language)
    || auditProgramResultText(point.auditProgramResult, "name", language)
    || (!point.auditReportPoint && !point.auditProgramResult && language === "ru" ? point.title : "");
}

/** Сохраняет исходный пункт для ответа органа независимо от описания исполнителя. */
export function workAuditPointSource(point: ReportPoint) {
  const source = point.auditReportPoint || point.auditProgramResult;
  const language = source?.language ?? (point.titleKk === point.title && !point.titleRu ? "kk" : "ru");
  const otherLanguage = language === "ru" ? "kk" : "ru";
  const otherTitle = reportPointTitle(point, otherLanguage);
  const translations = structuredClone(source?.translations ?? {});
  if (otherTitle) translations[otherLanguage] = { ...translations[otherLanguage], name: otherTitle };
  if (point.auditProgramResult) {
    return { auditProgramResult: { ...structuredClone(point.auditProgramResult), translations } };
  }
  const section = point.auditReportPoint ?? {
    number: point.number, name: point.title, text: point.finding, language,
  };
  return { auditReportPoint: { ...structuredClone(section), translations } };
}

export function sourceViolationText(
  point: Pick<ViolationPoint, "auditProgramResult" | "auditReportPoint" | "prescriptionText">,
  language: DocumentLanguage,
) {
  return point.prescriptionText?.[language] ?? (point.auditReportPoint ? auditReportPointText(point.auditReportPoint, "text", language) : auditProgramResultText(point.auditProgramResult, "answer", language));
}

export function auditReportPointText(point: AuditReportPoint | undefined, field: "name" | "text", language: DocumentLanguage, includeOriginal = false): string {
  if (!point) return "";
  return point.translations?.[language]?.[field] ?? (point.language === language || includeOriginal ? point[field] : "");
}

/** Подтверждённый текст отчёта; наименование никогда не заменяет его ответ. */
export function auditProgramResultText(
  result: AuditProgramResult | undefined,
  field: "name" | "answer",
  language: DocumentLanguage,
  includeOriginal = false,
): string {
  if (!result) return "";
  return (
    result.translations?.[language]?.[field] ??
    (result.language === language || includeOriginal ? result[field] : "")
  );
}
