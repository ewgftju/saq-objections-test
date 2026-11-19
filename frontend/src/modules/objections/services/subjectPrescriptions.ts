import type { DemoState, Role } from "../../../types";
import { DEMO_SUBJECT_PRESCRIPTION } from "../../../data/subjectPrescription";
import { subjectRoleForIdentifier } from "./saqCabinets";
import { CLOSED } from "../../../data/constants";

export function subjectPrescriptions(state: DemoState, role: Role) {
  if (role !== "subject2") return [];
  return structuredClone(
    (state.subjectPrescriptions ?? [DEMO_SUBJECT_PRESCRIPTION]).filter(
      (source) =>
        source.documentKind === "prescription" &&
        source.available !== false &&
        subjectRoleForIdentifier(source.bin) === role &&
        source.number.trim() &&
        source.date &&
        source.relatedAuditReport?.number.trim() &&
        source.relatedAuditReport.date,
    ),
  );
}

export function saveSubjectIssueDescription(
  state: DemoState,
  caseId: string,
  pointId: string,
  description: string,
  role: Role,
): DemoState {
  if (role !== "work")
    throw new Error("Описание заполняет исполнитель рабочего органа.");
  const source = state.cases.find((c) => c.id === caseId);
  if (
    !source ||
    source.subjectAppeal?.report.documentKind !== "prescription" ||
    source.status === "received" ||
    source.status === "forwarded" ||
    CLOSED.includes(source.status) ||
    source.certificate
  )
    throw new Error(
      "Описание доступно после назначения исполнителя по жалобе на предписание, до формирования справки и завершения рассмотрения.",
    );
  const point = source.issues.find((p) => p.id === pointId);
  if (!point) throw new Error("Оспариваемый пункт не найден.");
  const title = description.trim();
  if (!title) throw new Error("Заполните описание оспариваемого вопроса.");
  const next = structuredClone(state);
  const target = next.cases.find((c) => c.id === caseId)!;
  const targetPoint = target.issues.find((p) => p.id === pointId)!;
  const language = target.appealLanguage || "ru";
  targetPoint.title = title;
  targetPoint.translations = {
    ...targetPoint.translations,
    [language]: { ...targetPoint.translations?.[language], title },
  };
  target.history.push({
    date: state.date,
    actor: "Исполнитель рабочего органа",
    title: "Заполнено описание оспариваемого вопроса",
    text: `Пункт № ${point.number}: ${title}`,
  });
  return next;
}
