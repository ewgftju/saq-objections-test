import { makeCase } from "./objections";
import { attachment } from "./auditPlusCases";
import { nextCaseNumber } from "../modules/objections/services/caseNumbering";
import type { ObjectionCase } from "../types";

const scenarios = [
  { name: "Возражение на уведомление", type: "notice", appealType: "Возражение на уведомление", document: "Уведомление об устранении нарушений" },
  { name: "Предписание по аудиторскому отчету", type: "control", appealType: "Жалоба на решение КВГА/ДВГА", document: "Предписание", kind: "prescription-audit" },
  { name: "Предписание по профилактическому контролю", type: "control", appealType: "Жалоба на решение КВГА/ДВГА", document: "Предписание", kind: "prescription-preventive" },
  { name: "Акт профилактического контроля", type: "control", appealType: "Жалоба на решение КВГА/ДВГА", document: "Акт о результате профилактического контроля", kind: "preventive-control-act" },
  { name: "Контроль качества", type: "control", appealType: "Жалоба на решение КВГА/ДВГА", document: "Результат контроля качества", kind: "quality-control" },
  { name: "Административный акт", type: "control", appealType: "Жалоба на решение КВГА/ДВГА", document: "Административный акт", kind: "administrative-act" },
  { name: "Действия по закупке", type: "control", appealType: "Жалоба на действие/бездействие", document: "Первичное обращение", procurement: true },
  { name: "Действия вне закупки", type: "control", appealType: "Жалоба на действие/бездействие", document: "Первичное обращение", procurement: false },
] as const;

export function installComplaintTestCases(existing: ObjectionCase[]): ObjectionCase[] {
  const cases = [...existing];
  scenarios.forEach((scenario, index) => {
    const org = `ТОО "Тест обращения ${index + 1}"`;
    const appealNumber = `ТЕСТ-${index + 1}`;
    if (cases.some(c => c.org === org && c.appealNumber === appealNumber)) return;
    const details = {
      auditObjectName: org, auditObjectBin: "001002003004", applicantIsAuditObjectRepresentative: false,
      ...("kind" in scenario ? { decisionKind: scenario.kind, ...(["prescription-audit", "prescription-preventive"].includes(scenario.kind) ? { relatedDocumentNumber: `ТЕСТ-О-${index + 1}`, relatedDocumentDate: "2026-09-01" } : {}) } : {}),
      ...("procurement" in scenario ? { actionAppealAuthorities: [{ issuer: "ДВГА по г. Алматы", documentNumber: `ТЕСТ-П-${index + 1}`, documentDate: "2026-09-03" }] } : {}),
      ...("procurement" in scenario && scenario.procurement ? { procurementNumber: "12345678", lotNumber: "12345", procurementSubject: "Поставка учебного оборудования" } : {}),
      ...(index === 0 ? { procurementMethod: "конкурс", customerName: "Тестовая школа", customerBin: "001002003004" } : {}),
    };
    const c = makeCase({
      id: nextCaseNumber(cases, scenario.appealType, "2026-09-08"),
      type: scenario.type, appealType: scenario.appealType, appealLanguage: "ru", appealNumber, appealDate: "2026-09-07",
      org, orgTranslations: { ru: org }, bin: "001002003004", applicantIdentifierType: "БИН", address: "г. Алматы", applicant: "",
      registered: "2026-09-08", filed: "2026-09-08", channel: "ОДО", issuer: "ДВГА по г. Алматы", authority: "Апелляционная комиссия при Министерстве финансов РК",
      document: { number: `ТЕСТ-Д-${index + 1}`, date: "2026-09-03", received: "2026-09-08", name: scenario.document, ...(index === 0 ? { appealExplained: true } : {}) },
      agendaDetails: details, request: `Тестовое обращение: ${scenario.name}. Просим рассмотреть доводы и отменить обжалуемое решение.`, amount: index === 0 ? 1000005 : 0,
      issues: [{ id: "point1", number: "1", title: `Тестовый вопрос: ${scenario.name}`, finding: "", argument: "Заявитель считает вывод необоснованным и просит учесть приложенные документы.", evidence: "Тест 2(1).docx", disputed: true, amount: 0 }],
    });
    c.documents = ["Требования заявителя", "Доказательства по оспариваемому пункту 1"].map(text => ({ name: "Тест 2(1).docx", filename: "Тест 2(1).docx", kind: "attachment" as const, text, author: "Заявитель", date: "2026-09-08", dataUrl: attachment }));
    cases.push(c);
  });
  return cases;
}
