import type { ObjectionCase, SubjectAuditReport } from "../types";

/** Заглушка реквизитов ВГА для отчёта № 1-АО от 05.09.2026. */
export function testAuditReportDetails(source: ObjectionCase) {
  if (source.bin !== "001002003004" || source.document.number !== "1-АО" || source.document.date !== "2026-09-05") return undefined;
  return {
    org: "ГУ «Учебный центр инфраструктуры»",
    orgTranslations: {
      ru: "ГУ «Учебный центр инфраструктуры»",
      kk: "«Инфрақұрылым оқу орталығы» ММ",
    },
    bin: "001002003004",
    identifierType: "БИН" as const,
    address: "г. Астана, ул. Учебная, 1",
    addressTranslations: {
      ru: "г. Астана, ул. Учебная, 1",
      kk: "Астана қ., Учебная к., 1",
    },
    signerName: "Ахметов Аслан Ерланович",
    signerPositionTranslations: { ru: "Первый руководитель", kk: "Бірінші басшы" },
  };
}

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
