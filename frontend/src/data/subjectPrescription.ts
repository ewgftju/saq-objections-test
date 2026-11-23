import type { SubjectAuditReport } from "../types";
import { SUBJECT_2_PROFILE } from "./subjectProfiles";

const ru = [
  "возместить (перечислить) в бюджет сумму 0 тыс. тенге на код бюджетной классификации –;",
  "обеспечить поставку товаров, выполнение работ, оказание услуг на сумму 0 тыс. тенге;",
  "восстановить по бухгалтерскому учету и финансовой отчетности сумму 0 тыс. тенге;",
  "по нарушениям в сфере государственных закупок: –;",
  "рассмотреть дисциплинарную ответственность должностных лиц, допустивших выявленные нарушения: –.",
];
const kk = [
  "бюджетке 0 мың теңге сомасын – бюджеттік сыныптама кодына өтеу (аудару);",
  "0 мың теңге сомасына тауарларды жеткізуді, жұмыстарды орындауды, қызметтер көрсетуді қамтамасыз ету;",
  "бухгалтерлік есеп және қаржылық есептілік бойынша 0 мың теңге сомасын қалпына келтіру;",
  "мемлекеттік сатып алу саласындағы бұзушылықтар бойынша: –;",
  "анықталған бұзушылықтарға жол берген лауазымды адамдардың тәртіптік жауапкершілігін қарау: –.",
];

/** Тестовый документ ВГА; связь с отчётом также демонстрационная. */
export const DEMO_SUBJECT_PRESCRIPTION: SubjectAuditReport = {
  documentKind: "prescription",
  prescriptionSubtype: "audit",
  sourceCaseId: "vga-prescription-30101-26-000072-50002",
  number: "ПнУН-30101-26-000072/50002",
  date: "2026-11-17",
  received: "2026-11-17",
  available: true,
  relatedAuditReport: { number: "1-АО", date: "2026-09-05" },
  org: SUBJECT_2_PROFILE.orgTranslations.ru,
  orgTranslations: { ...SUBJECT_2_PROFILE.orgTranslations },
  bin: SUBJECT_2_PROFILE.bin,
  identifierType: "БИН",
  address: "г. Алматы",
  issuer: "ДВГА по Атырауской области",
  points: ru.map((text, index) => ({
    id: `prescription-clause-${index + 1}`,
    number: String(index + 1),
    title: "",
    finding: "",
    amount: 0,
    prescriptionText: { ru: text, kk: kk[index] },
  })),
};


/** Демонстрационное предписание по профилактическому контролю — не реальный документ ВГА. */
export const DEMO_PREVENTIVE_PRESCRIPTION: SubjectAuditReport = {
  documentKind: "prescription",
  prescriptionSubtype: "preventive",
  sourceCaseId: "demo-preventive-control-prescription-001",
  number: "ТЕСТ-ПК-2026-001",
  date: "2026-11-17",
  received: "2026-11-17",
  available: true,
  org: SUBJECT_2_PROFILE.orgTranslations.ru,
  orgTranslations: { ...SUBJECT_2_PROFILE.orgTranslations },
  bin: SUBJECT_2_PROFILE.bin,
  identifierType: "БИН",
  address: "г. Алматы",
  issuer: "ДВГА по Атырауской области",
  points: [
    {
      id: "preventive-prescription-1",
      number: "1",
      title: "",
      finding: "",
      amount: 0,
      prescriptionText: {
        ru: "Тестовый пункт предписания по профилактическому контролю № 1.",
        kk: "Профилактикалық бақылау жөніндегі нұсқаманың № 1 тестілік тармағы.",
      },
    },
    {
      id: "preventive-prescription-2",
      number: "2",
      title: "",
      finding: "",
      amount: 0,
      prescriptionText: {
        ru: "Тестовый пункт предписания по профилактическому контролю № 2.",
        kk: "Профилактикалық бақылау жөніндегі нұсқаманың № 2 тестілік тармағы.",
      },
    },
  ],
};
