import type { AuditProgramResult, DocumentLanguage, ViolationPoint } from "../../../types";

export function sourceViolationText(
  point: Pick<ViolationPoint, "auditProgramResult" | "prescriptionText">,
  language: DocumentLanguage,
) {
  return point.prescriptionText?.[language] ?? auditProgramResultText(point.auditProgramResult, "answer", language);
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
