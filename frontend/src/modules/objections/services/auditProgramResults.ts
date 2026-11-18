import type { AuditProgramResult, DocumentLanguage } from "../../../types";

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
