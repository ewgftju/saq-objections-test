import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "../../../components/ui";
import type { SubjectAppealDraft, SubjectAuditReport } from "../../../types";
import { addSubjectAppealPoint, removeSubjectAppealPoint } from "../services/subjectAppealPoints";
import { auditReportPointText } from "../services/auditProgramResults";
import AuditReportPointPicker from "./AuditReportPointPicker";

export default function SubjectAuditPointEditor({ report, draft, onChange, renderFiles, circumstancesLabel, disabled = false }: {
  report: SubjectAuditReport;
  draft: SubjectAppealDraft;
  onChange: (draft: SubjectAppealDraft) => void;
  renderFiles: (pointId: string) => ReactNode;
  circumstancesLabel: string;
  disabled?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [focusPointId, setFocusPointId] = useState<string>();
  const available = report.points.filter(point => !draft.selectedPointIds.includes(point.id));
  const selected = report.points.filter(point => draft.selectedPointIds.includes(point.id));
  const title = (point: SubjectAuditReport["points"][number]) => auditReportPointText(point.auditReportPoint, "name", draft.language, true) || (draft.language === "kk" ? point.titleKk : point.titleRu) || point.title;
  return <div className="subject-appeal-point-editor">
    <div className="subject-appeal-point-heading">
      <span>Добавлено пунктов: {selected.length}</span>
      <Button disabled={disabled || adding || !available.length} onClick={() => setAdding(true)}>+ Добавить пункт</Button>
    </div>
    {adding && <section className="subject-appeal-point subject-audit-new-point">
      <AuditReportPointPicker points={available.map(point => ({ id: point.id, number: point.number, title: title(point) }))} disabled={disabled}
        onSelect={pointId => {
          onChange(addSubjectAppealPoint(draft, report, pointId));
          setFocusPointId(pointId);
          setAdding(false);
        }} />
      <Button disabled={disabled} onClick={() => setAdding(false)}>Отмена</Button>
    </section>}
    {!selected.length && !adding && <p className="subject-appeal-hint">Добавьте пункт аудиторского отчёта, по которому подаёте возражение.</p>}
    {selected.map(point => <section className="subject-appeal-point selected" key={point.id} aria-label={`Пункт аудиторского отчёта № ${point.number}`}>
      <div className="subject-audit-point-header">
        <div><b>Пункт аудиторского отчёта № {point.number}</b><p>{title(point)}</p></div>
        <Button disabled={disabled} onClick={() => onChange(removeSubjectAppealPoint(draft, point.id))}>Удалить пункт</Button>
      </div>
      <div className="subject-appeal-point-body">
        <label className="field">
          <span>{circumstancesLabel} <span className="required">*</span></span>
          <textarea autoFocus={focusPointId === point.id} aria-label={`Обстоятельства по пункту ${point.number}`} required rows={4} value={draft.argumentsByPoint[point.id] || ""} onChange={event => onChange({ ...draft, argumentsByPoint: { ...draft.argumentsByPoint, [point.id]: event.target.value } })} />
        </label>
        {renderFiles(point.id)}
      </div>
    </section>)}
  </div>;
}
