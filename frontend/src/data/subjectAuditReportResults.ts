import type { ObjectionCase, SubjectAuditReport } from "../types";

/** Результаты исходного тестового отчёта ВГА, доступного в кабинете объекта №2. */
export function testAuditReportPoints(
  source: ObjectionCase,
): SubjectAuditReport["points"] | undefined {
  if (
    source.bin !== "001002003004" ||
    source.org !== 'Товарищество с ограниченной ответственностью "Audit plus #1"' ||
    source.document.number !== "1-АО" ||
    source.document.date !== "2026-09-05" ||
    source.issues.some((point) => point.auditProgramResult)
  )
    return undefined;

  return [
    {
      number: "1",
      name: "Представительские расходы",
      answer: Array(5)
        .fill("Расходы выявленные представителями были там то там то тестово направлены и сгенерированы.")
        .join(" "),
    },
    {
      number: "2",
      name: "Контроль приобретения, хранение и списание продуктов питания, медикаментов и мягкого инвентаря в сфере образования",
      answer: Array(4)
        .fill("Ответ был тестовый нарушение не выявлены в части теста.")
        .join(" "),
    },
  ].map((result) => ({
    id: "vga-test-question-" + result.number,
    number: result.number,
    title: result.name,
    titleRu: result.name,
    finding: "",
    amount: 0,
    auditProgramResult: { ...result, language: "ru" },
  }));
}
