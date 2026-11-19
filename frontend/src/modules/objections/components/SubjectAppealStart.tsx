import { useState } from "react";
import type { ComponentProps } from "react";
import { Button, Modal, Notice } from "../../../components/ui";
import { formatDate } from "../../../utils/dateFormat";
import {
  availableSubjectAuditReports,
  subjectAppealFilingWindow,
} from "../services/subjectAppeals";
import SubjectAppealForm from "./SubjectAppealForm";
import SubjectPrescriptionForm from "./SubjectPrescriptionForm";
import { subjectPrescriptions } from "../services/subjectPrescriptions";

type AppealKind = "" | "audit" | "prescription";

export default function SubjectAppealStart(
  props: ComponentProps<typeof SubjectAppealForm>,
) {
  const { state, role, draftId, onClose } = props;
  const savedDraft = state.subjectAppealDrafts?.find(
    (draft) => draft.id === draftId && draft.ownerRole === role,
  );
  const [kind, setKind] = useState<AppealKind>(
    savedDraft
      ? savedDraft.documentKind === "prescription"
        ? "prescription"
        : "audit"
      : "",
  );
  const [reportId, setReportId] = useState(savedDraft?.sourceCaseId || "");
  const [openForm, setOpenForm] = useState(Boolean(savedDraft));
  const reports = availableSubjectAuditReports(state.cases, role, state.date);
  const prescriptions = subjectPrescriptions(state, role);
  const selectedReport = reports.find(
    (report) => report.sourceCaseId === reportId,
  );
  const selectedPrescription = prescriptions.find(
    (p) => p.sourceCaseId === reportId,
  );
  if (kind === "prescription" && openForm && selectedPrescription) {
    return (
      <SubjectPrescriptionForm
        {...props}
        prescriptionId={selectedPrescription.sourceCaseId}
      />
    );
  }

  if (kind === "audit" && openForm && selectedReport) {
    // Состав существующей формы сохранён; ей доступен только выбранный отчёт.
    return (
      <SubjectAppealForm
        {...props}
        state={{
          ...state,
          cases: state.cases.filter(
            (c) => c.id === selectedReport.sourceCaseId,
          ),
        }}
      />
    );
  }

  return (
    <Modal title="Подать обращение" onClose={onClose}>
      <label className="field">
        <span>Вид обращения</span>
        <select
          aria-label="Вид обращения"
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as AppealKind);
            setReportId("");
            setOpenForm(false);
          }}
        >
          <option value="">Выберите вид обращения</option>
          <option value="audit">Возражение на аудиторский отчёт</option>
          <option value="prescription">
            Жалоба на предписание об устранении нарушений по аудиторскому отчёту
          </option>
        </select>
      </label>

      {kind === "audit" &&
        (reports.length ? (
          <>
            <label className="field">
              <span>Аудиторский отчёт</span>
              <select
                aria-label="Аудиторский отчёт"
                value={selectedReport?.sourceCaseId || ""}
                onChange={(event) => setReportId(event.target.value)}
              >
                <option value="">Выберите аудиторский отчёт</option>
                {reports.map((report) => (
                  <option key={report.sourceCaseId} value={report.sourceCaseId}>
                    № {report.number} от {formatDate(report.date)}
                  </option>
                ))}
              </select>
            </label>
            <Notice>
              Возражение можно подать в течение 10 рабочих дней с даты
              представления подписанного аудиторского отчёта.
              {selectedReport && (
                <>
                  {" "}
                  Последний день подачи —{" "}
                  <b>
                    {formatDate(
                      subjectAppealFilingWindow(selectedReport, state.date)
                        .deadline,
                    )}
                  </b>{" "}
                  включительно.
                </>
              )}
            </Notice>
          </>
        ) : (
          <Notice tone="amber">
            Нет доступных для подачи возражения аудиторских отчётов. Подача
            доступна в течение 10 рабочих дней с даты представления подписанного
            аудиторского отчёта.
          </Notice>
        ))}

      {kind === "prescription" &&
        (prescriptions.length ? (
          <label className="field">
            <span>Предписание</span>
            <select
              aria-label="Предписание"
              value={selectedPrescription?.sourceCaseId || ""}
              onChange={(event) => setReportId(event.target.value)}
            >
              <option value="">Выберите предписание</option>
              {prescriptions.map((p) => (
                <option key={p.sourceCaseId} value={p.sourceCaseId}>
                  № {p.number} от {formatDate(p.date)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <Notice tone="amber">
            Нет доступных для обжалования предписаний.
          </Notice>
        ))}

      <div className="actions">
        <Button onClick={onClose}>Закрыть</Button>
        {((kind === "audit" && reports.length > 0) ||
          (kind === "prescription" && prescriptions.length > 0)) && (
          <Button
            primary
            disabled={
              kind === "prescription" ? !selectedPrescription : !selectedReport
            }
            onClick={() => setOpenForm(true)}
          >
            Продолжить
          </Button>
        )}
      </div>
    </Modal>
  );
}
