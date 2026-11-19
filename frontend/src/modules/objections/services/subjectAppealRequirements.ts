import type { CaseDocument, ObjectionCase } from "../../../types";
import { subjectAppealHtml } from "../components/SubjectAppealDocument";

/** Сохраняем именно поданную форму с её языком, реквизитами и доводами. */
export function subjectAppealRequirementDocument(
  c: ObjectionCase,
): CaseDocument | undefined {
  const saved = c.subjectAppeal;
  if (!saved) return undefined;
  const name = saved.report.documentKind === "prescription"
    ? saved.draft.language === "kk" ? "Шағым" : "Жалоба"
    : saved.draft.language === "kk" ? "Қарсылық" : "Возражение";
  const filename = `${name}_${c.id}_${saved.draft.language}.html`;
  return {
    kind: "attachment",
    name: `${name} ${c.id} — печатная форма`,
    filename,
    text: "Требования заявителя",
    date: saved.submittedAt,
    author: c.org,
    languages: [saved.draft.language],
    subjectAppealId: saved.draft.id,
    dataUrl: "data:text/html;charset=utf-8," + encodeURIComponent(
      subjectAppealHtml(saved.report, saved.draft, saved.submittedAt, true),
    ),
  };
}

export function applicantRequirementFiles(c: ObjectionCase): CaseDocument[] {
  const files = c.documents.filter(
    (document) => document.kind === "attachment" && document.text === "Требования заявителя",
  );
  // Поддержка обращений, поданных до автоматического вложения печатной формы.
  if (!c.subjectAppeal || files.some(
    (document) => document.subjectAppealId === c.subjectAppeal!.draft.id,
  )) return files;
  const generated = subjectAppealRequirementDocument(c);
  return generated ? [...files, generated] : files;
}
