import type { DemoState } from "../../../types";
import { reportFingerprint, subjectAuditReports } from "./subjectAppeals";

export const SUBJECT_2_PROFILE = {
  bin: "001002003004",
  orgTranslations: {
    ru: 'Товарищество с ограниченной ответственностью "Audit plus #1"',
    kk: "«Audit plus #1» жауапкершілігі шектеулі серіктестігі",
  },
} as const;

/** Дополняет реквизиты объекта; поданные документы сохраняют свой снимок. */
export function applySubject2Profile(state: DemoState): DemoState {
  const cases = state.cases.map((c) =>
    !c.subjectAppeal &&
    c.bin === SUBJECT_2_PROFILE.bin &&
    c.org === SUBJECT_2_PROFILE.orgTranslations.ru &&
    !c.orgTranslations?.kk
      ? {
          ...c,
          orgTranslations: {
            ...c.orgTranslations,
            kk: SUBJECT_2_PROFILE.orgTranslations.kk,
          },
        }
      : c,
  );
  if (cases.every((c, index) => c === state.cases[index])) return state;

  const previousReports = subjectAuditReports(state.cases, "subject2");
  const updatedReports = subjectAuditReports(cases, "subject2");
  const submittedDraftIds = new Set(
    state.cases.flatMap((c) =>
      c.subjectAppeal ? [c.subjectAppeal.draft.id] : [],
    ),
  );
  return {
    ...state,
    cases,
    subjectAppealDrafts: state.subjectAppealDrafts?.map((draft) => {
      const previous = previousReports.find(
        (r) => r.sourceCaseId === draft.sourceCaseId,
      );
      const updated = updatedReports.find(
        (r) => r.sourceCaseId === draft.sourceCaseId,
      );
      // Обновляем отпечаток только при совпадении с прежним исходным отчётом.
      if (
        draft.ownerRole !== "subject2" ||
        submittedDraftIds.has(draft.id) ||
        !previous ||
        !updated ||
        draft.sourceFingerprint !== reportFingerprint(previous)
      )
        return draft;
      return { ...draft, sourceFingerprint: reportFingerprint(updated) };
    }),
  };
}
