import type { AuditProgramResult, AuditReportPoint, DocumentLanguage, ViolationPoint } from "../../../types";

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
