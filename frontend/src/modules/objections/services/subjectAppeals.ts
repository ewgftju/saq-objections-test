import { makeCase } from "../../../data/objections";
import { testAuditReportPoints } from "../../../data/subjectAuditReportResults";
import type {
  DemoState,
  ObjectionCase,
  Role,
  SubjectAppealDraft,
  SubjectAuditReport,
} from "../../../types";
import { nextCaseNumber } from "./caseNumbering";
import { subjectRoleForIdentifier } from "./saqCabinets";
import { auditProgramResultText } from "./auditProgramResults";

export const SUBJECT_APPEAL_TYPE = "Возражение на аудиторский отчет";
export const MAX_APPEAL_FILE_SIZE = 2 * 1024 * 1024;

/**
 * Адаптер исходных отчётов макета. В рабочей SAQ этот список поступает из ВГА,
 * а реквизиты заявителя — из профиля кабинета. Не переносим из дел внутренние
 * материалы, ответы КВГА/ДВГА, результаты рассмотрения и доводы других лиц.
 */
export function subjectAuditReports(
  cases: readonly ObjectionCase[],
  role: Role,
): SubjectAuditReport[] {
  if (role !== "subject2") return [];
  const seen = new Set<string>();
  return cases.flatMap((c) => {
    if (
      c.type !== "audit" ||
      c.subjectAppeal ||
      subjectRoleForIdentifier(c.bin) !== role ||
      !c.document.number.trim()
    )
      return [];
    const key = JSON.stringify([
      c.bin,
      c.issuer,
      c.document.number,
      c.document.date,
    ]);
    if (seen.has(key)) return [];
    seen.add(key);
    return [
      {
        sourceCaseId: c.id,
        number: c.document.number,
        date: c.document.date,
        received: c.document.received,
        org: c.org,
        orgTranslations: c.orgTranslations && { ...c.orgTranslations },
        bin: c.bin,
        identifierType: c.applicantIdentifierType || "БИН",
        address: c.address,
        issuer: c.issuer,
        points: testAuditReportPoints(c) ?? c.issues.map((point) => ({
          id: point.id,
          number: point.auditProgramResult?.number ?? point.number,
          title: point.auditProgramResult?.name ?? point.title,
          titleKk: point.auditProgramResult
            ? auditProgramResultText(point.auditProgramResult, "name", "kk") ||
              undefined
            : point.translations?.kk?.title,
          titleRu: point.auditProgramResult
            ? auditProgramResultText(point.auditProgramResult, "name", "ru") ||
              undefined
            : point.translations?.ru?.title,
          finding: point.finding,
          auditProgramResult:
            point.auditProgramResult &&
            structuredClone(point.auditProgramResult),
          amount: point.amount,
        })),
      },
    ];
  });
}

export function reportFingerprint(report: SubjectAuditReport) {
  return JSON.stringify(report);
}

export function createSubjectAppealDraft(
  report: SubjectAuditReport,
  id: string,
): SubjectAppealDraft {
  return {
    id,
    ownerRole: "subject2",
    sourceCaseId: report.sourceCaseId,
    sourceFingerprint: reportFingerprint(report),
    language: "ru",
    circumstancesMode: "per-point",
    circumstances: "",
    documentList: "",
    signerName: "",
    signerPosition: "Руководитель",
    place: report.address,
    selectedPointIds: [],
    argumentsByPoint: {},
    attachments: [],
  };
}

function reportForDraft(
  state: DemoState,
  draft: SubjectAppealDraft,
  role: Role,
) {
  if (role !== "subject2" || draft.ownerRole !== role)
    throw new Error("Подача доступна в кабинете объекта №2.");
  const report = subjectAuditReports(state.cases, role).find(
    (item) => item.sourceCaseId === draft.sourceCaseId,
  );
  if (!report) throw new Error("Отчёт недоступен в этом кабинете.");
  if (draft.sourceFingerprint !== reportFingerprint(report))
    throw new Error(
      "Реквизиты отчёта изменились. Проверьте отчёт и выберите его заново.",
    );
  return report;
}

export function saveSubjectAppealDraft(
  state: DemoState,
  draft: SubjectAppealDraft,
  role: Role,
): DemoState {
  reportForDraft(state, draft, role);
  if (state.cases.some((c) => c.subjectAppeal?.draft.id === draft.id))
    throw new Error("Это обращение уже направлено.");
  return {
    ...state,
    subjectAppealDrafts: [
      ...(state.subjectAppealDrafts || []).filter(
        (item) => item.id !== draft.id,
      ),
      structuredClone({ ...draft, documentList: draft.documentList ?? "", circumstancesMode: "per-point" as const, savedAt: state.date }),
    ],
  };
}

export function validateSubjectAppeal(
  draft: SubjectAppealDraft,
  report: SubjectAuditReport,
) {
  if (!["ru", "kk"].includes(draft.language))
    throw new Error("Выберите язык обращения.");
  if (!draft.signerName.trim()) throw new Error("Укажите Ф.И.О. подписанта.");
  if (!draft.place.trim()) throw new Error("Укажите место составления.");
  if (!draft.selectedPointIds.length)
    throw new Error("Выберите хотя бы один оспариваемый пункт отчёта.");
  if (new Set(draft.selectedPointIds).size !== draft.selectedPointIds.length)
    throw new Error("Оспариваемые пункты не должны повторяться.");
  const selected = new Set(draft.selectedPointIds);
  for (const id of selected) {
    const point = report.points.find((item) => item.id === id);
    if (!point) throw new Error("Выбран пункт, которого нет в этом отчёте.");
    if (!draft.argumentsByPoint[id]?.trim())
      throw new Error(
        "Заполните обстоятельства (довод заявителя) по пункту № " + point.number + ".",
      );
  }
  for (const file of draft.attachments) {
    if (
      file.size > MAX_APPEAL_FILE_SIZE ||
      file.size < 0 ||
      !file.dataUrl.startsWith("data:") ||
      !/\.(pdf|docx?|xlsx?|png|jpe?g|txt)$/i.test(file.name)
    )
      throw new Error(
        "Проверьте вложение «" + file.name + "»: допустимый файл до 2 МБ.",
      );
    if (file.pointId && !selected.has(file.pointId))
      throw new Error("Доказательство привязано к невыбранному пункту.");
  }
}

export function submitSubjectAppeal(
  state: DemoState,
  draft: SubjectAppealDraft,
  role: Role,
): { state: DemoState; caseId: string } {
  if (role !== "subject2" || draft.ownerRole !== role)
    throw new Error("Подача доступна в кабинете объекта №2.");
  const existing = state.cases.find(
    (c) =>
      c.subjectAppeal?.draft.id === draft.id &&
      c.subjectAppeal.draft.ownerRole === role,
  );
  if (existing) return { state, caseId: existing.id };
  const report = reportForDraft(state, draft, role);
  validateSubjectAppeal(draft, report);
  const selected = new Set(draft.selectedPointIds);
  const id = nextCaseNumber(state.cases, SUBJECT_APPEAL_TYPE, state.date);
  const org = report.orgTranslations?.[draft.language] || report.org;
  const issues = report.points
    .filter((p) => selected.has(p.id))
    .map((p) => ({
      id: p.id,
      number: p.number,
      title: (draft.language === "kk" ? p.titleKk : p.titleRu) || p.title,
      translations: {
        ...(p.titleRu ? { ru: { title: p.titleRu } } : {}),
        ...(p.titleKk ? { kk: { title: p.titleKk } } : {}),
      },
      finding: p.finding,
      authorityFinding: auditProgramResultText(
        p.auditProgramResult,
        "answer",
        draft.language,
      ),
      auditProgramResult:
        p.auditProgramResult && structuredClone(p.auditProgramResult),
      argument: draft.argumentsByPoint[p.id].trim(),
      disputed: true,
      amount: p.amount,
      evidence: draft.attachments
        .filter((file) => file.pointId === p.id)
        .map((file) => file.name)
        .join(", "),
    }));
  const created = makeCase({
    id,
    type: "audit",
    appealType: SUBJECT_APPEAL_TYPE,
    appealLanguage: draft.language,
    appealNumber: id,
    appealDate: state.date,
    org,
    orgTranslations: report.orgTranslations && { ...report.orgTranslations },
    bin: report.bin,
    applicantIdentifierType: report.identifierType,
    address: report.address,
    applicant: "",
    registered: state.date,
    filed: state.date,
    channel: "SAQ",
    issuer: report.issuer,
    authority: "Апелляционная комиссия при Министерстве финансов РК",
    document: {
      name: "Аудиторский отчет",
      number: report.number,
      date: report.date,
      received: report.received,
    },
    agendaDetails: { auditObjectName: report.org, auditObjectBin: report.bin },
    amount: issues.reduce((sum, point) => sum + point.amount, 0),
    request:
      "Возражение на аудиторский отчёт № " +
      report.number +
      ". Оспариваемые пункты: " +
      issues.map((point) => point.number).join(", ") +
      ".",
    issues,
  });
  created.subjectAppeal = structuredClone({
    report,
    draft: { ...draft, documentList: draft.documentList ?? "", circumstancesMode: "per-point" },
    submittedAt: state.date,
  });
  created.documents = [
    {
      kind: "original",
      name: draft.language === "kk" ? "Қарсылық" : "Возражение",
      text: issues.map((point) => "№ " + point.number + ". " + point.argument).join("\n\n"),
      date: state.date,
      author: org,
      languages: [draft.language],
    },
    ...draft.attachments.map((file) => ({
      kind: "attachment",
      name: file.name,
      filename: file.name,
      dataUrl: file.dataUrl,
      text: file.pointId
        ? "Доказательства по пункту № " +
          report.points.find((point) => point.id === file.pointId)?.number
        : "Приложение к обращению",
      date: state.date,
      author: org,
    })),
  ];
  const next = {
    ...state,
    cases: [created, ...state.cases],
    subjectAppealDrafts: (state.subjectAppealDrafts || []).filter(
      (item) => item.id !== draft.id,
    ),
    notifications: [
      ...state.notifications,
      {
        id: "subject-appeal-" + id,
        caseId: id,
        recipient: "Директор ДАВГА",
        recipientRole: "director" as const,
        text:
          "Из кабинета объекта №2 поступило обращение " +
          id +
          " по отчёту № " +
          report.number +
          ". Назначьте исполнителя рабочего органа.",
        date: state.date,
        read: false,
      },
    ],
  };
  return { state: next, caseId: id };
}
