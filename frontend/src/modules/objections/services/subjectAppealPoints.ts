import type { SubjectAppealDraft, SubjectAuditReport } from "../../../types";

export function addSubjectAppealPoint(draft: SubjectAppealDraft, report: SubjectAuditReport, pointId: string): SubjectAppealDraft {
  if (!report.points.some(point => point.id === pointId)) throw new Error("Выберите пункт из выбранного аудиторского отчёта.");
  if (draft.selectedPointIds.includes(pointId)) throw new Error("Этот пункт уже добавлен.");
  return { ...draft, selectedPointIds: [...draft.selectedPointIds, pointId] };
}

export function removeSubjectAppealPoint(draft: SubjectAppealDraft, pointId: string): SubjectAppealDraft {
  const argumentsByPoint = { ...draft.argumentsByPoint };
  delete argumentsByPoint[pointId];
  return {
    ...draft,
    selectedPointIds: draft.selectedPointIds.filter(id => id !== pointId),
    argumentsByPoint,
    attachments: draft.attachments.filter(file => file.pointId !== pointId),
  };
}
