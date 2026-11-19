import { useRef, useState } from "react";
import type { ComponentProps } from "react";
import { Button, Modal, Notice } from "../../../components/ui";
import { formatDate } from "../../../utils/dateFormat";
import {
  createSubjectAppealDraft,
  MAX_APPEAL_FILE_SIZE,
  validateSubjectAppeal,
} from "../services/subjectAppeals";
import { subjectPrescriptions } from "../services/subjectPrescriptions";
import {
  printSubjectAppeal,
  subjectAppealHtml,
  SubjectAppealDocument,
} from "./SubjectAppealDocument";
import { downloadFile } from "../../../utils/download";
import type SubjectAppealForm from "./SubjectAppealForm";

export default function SubjectPrescriptionForm({
  prescriptionId,
  ...props
}: ComponentProps<typeof SubjectAppealForm> & { prescriptionId: string }) {
  const { state, role, draftId, onClose, onSave, onSubmit } = props;
  const source = subjectPrescriptions(state, role).find(
    (p) => p.sourceCaseId === prescriptionId,
  );
  const [draft, setDraft] = useState(() => {
    const saved = state.subjectAppealDrafts?.find(
      (d) =>
        d.ownerRole === role &&
        d.documentKind === "prescription" &&
        (draftId ? d.id === draftId : d.sourceCaseId === prescriptionId),
    );
    return saved
      ? structuredClone(saved)
      : source
        ? createSubjectAppealDraft(source, crypto.randomUUID())
        : undefined;
  });
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const sending = useRef(false);
  const kk = draft?.language === "kk";
  const t = (ru: string, kz: string) => (kk ? kz : ru);
  const handleError = (cause: unknown) =>
    setError(
      cause instanceof Error ? cause.message : "Не удалось сохранить жалобу.",
    );
  async function addFiles(files: FileList | null, pointId: string) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const values = await Promise.all(
        Array.from(files).map(async (file) => {
          if (
            file.size > MAX_APPEAL_FILE_SIZE ||
            !/\.(pdf|docx?|xlsx?|png|jpe?g|txt)$/i.test(file.name)
          )
            throw new Error(
              "Выберите документ, изображение или текстовый файл до 2 МБ.",
            );
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () =>
              reject(
                new Error("Не удалось прочитать файл «" + file.name + "»."),
              );
            reader.readAsDataURL(file);
          });
          return {
            id: crypto.randomUUID(),
            name: file.name,
            size: file.size,
            dataUrl,
            pointId,
          };
        }),
      );
      setDraft((current) =>
        current
          ? { ...current, attachments: [...current.attachments, ...values] }
          : current,
      );
    } catch (cause) {
      handleError(cause);
    } finally {
      setUploading(false);
    }
  }
  return (
    <Modal
      title={t("Жалоба на предписание", "Нұсқамаға шағым")}
      onClose={onClose}
      wide
    >
      {!source || !draft ? (
        <Notice tone="amber">
          Нет доступного предписания для подачи жалобы.
        </Notice>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (sending.current || uploading) return;
            setError("");
            try {
              validateSubjectAppeal(draft, source, state.date);
              sending.current = true;
              onSubmit(draft);
            } catch (cause) {
              sending.current = false;
              handleError(cause);
            }
          }}
        >
          <div className="subject-appeal-toolbar">
            <fieldset className="subject-appeal-language">
              <legend>{t("Язык обращения", "Жолданым тілі")}</legend>
              {(
                [
                  ["kk", "Қазақша"],
                  ["ru", "Русский"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={draft.language === value ? "selected" : ""}
                >
                  <input
                    type="radio"
                    name="appealLanguage"
                    value={value}
                    checked={draft.language === value}
                    onChange={() => setDraft({ ...draft, language: value })}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <Button onClick={() => setPreview(!preview)}>
              {preview
                ? t("Вернуться к заполнению", "Толтыруға оралу")
                : t("Предпросмотр", "Алдын ала қарау")}
            </Button>
          </div>
          <Notice>
            {t("Предписание", "Нұсқама")} № {source.number} {t("от", "күні")}{" "}
            {formatDate(source.date)}.<br />
            {t(
              "Связанный аудиторский отчёт",
              "Байланысты аудиторлық есеп",
            )} № {source.relatedAuditReport?.number} {t("от", "күні")}{" "}
            {formatDate(source.relatedAuditReport?.date)}.
          </Notice>
          <div className="subject-appeal-paper-background">
            <SubjectAppealDocument
              report={source}
              draft={draft}
              date={state.date}
              onChange={preview ? undefined : setDraft}
              pointEditor={
                preview ? undefined : (
                  <div className="subject-appeal-point-editor">
                    <p className="subject-appeal-hint">
                      {t(
                        "Выберите оспариваемые пункты предписания и укажите по каждому обоснование. Описание оспариваемого вопроса заполнит рабочий орган.",
                        "Нұсқаманың дауланатын тармақтарын таңдап, әрқайсысы бойынша негіздемені жазыңыз. Дауланатын мәселенің сипаттамасын жұмыс органы толтырады.",
                      )}
                    </p>
                    {source.points.map((point) => {
                      const selected = draft.selectedPointIds.includes(
                        point.id,
                      );
                      return (
                        <section
                          key={point.id}
                          className={
                            "subject-appeal-point" +
                            (selected ? " selected" : "")
                          }
                        >
                          <label className="subject-appeal-point-toggle">
                            <input
                              type="checkbox"
                              aria-label={
                                t("Оспорить пункт ", "Тармақты даулау ") +
                                point.number
                              }
                              checked={selected}
                              onChange={(event) =>
                                setDraft({
                                  ...draft,
                                  selectedPointIds: event.target.checked
                                    ? [...draft.selectedPointIds, point.id]
                                    : draft.selectedPointIds.filter(
                                        (id) => id !== point.id,
                                      ),
                                  attachments: event.target.checked
                                    ? draft.attachments
                                    : draft.attachments.filter(
                                        (f) => f.pointId !== point.id,
                                      ),
                                })
                              }
                            />
                            <span>
                              <b>
                                {t(
                                  "Пункт предписания № ",
                                  "Нұсқама тармағы № ",
                                )}
                                {point.number}
                              </b>
                              <span>
                                {point.prescriptionText?.[draft.language] ||
                                  "—"}
                              </span>
                            </span>
                          </label>
                          {selected && (
                            <div className="subject-appeal-point-body">
                              <label className="field">
                                <span>
                                  {t("Обоснование", "Негіздеме")}{" "}
                                  <span className="required">*</span>
                                </span>
                                <textarea
                                  aria-label={
                                    t(
                                      "Обоснование по пункту ",
                                      "Тармақ бойынша негіздеме ",
                                    ) + point.number
                                  }
                                  rows={5}
                                  required
                                  value={draft.argumentsByPoint[point.id] || ""}
                                  onChange={(event) =>
                                    setDraft({
                                      ...draft,
                                      argumentsByPoint: {
                                        ...draft.argumentsByPoint,
                                        [point.id]: event.target.value,
                                      },
                                    })
                                  }
                                />
                              </label>
                              <label className="field">
                                <span>
                                  {t("Доказательства", "Дәлелдемелер")}
                                </span>
                                <input
                                  type="file"
                                  multiple
                                  disabled={uploading}
                                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
                                  onChange={(event) => {
                                    void addFiles(
                                      event.currentTarget.files,
                                      point.id,
                                    );
                                    event.currentTarget.value = "";
                                  }}
                                />
                              </label>
                              {draft.attachments
                                .filter((f) => f.pointId === point.id)
                                .map((file) => (
                                  <div
                                    className="subject-appeal-file"
                                    key={file.id}
                                  >
                                    <span>{file.name}</span>
                                    <Button
                                      onClick={() =>
                                        setDraft({
                                          ...draft,
                                          attachments: draft.attachments.filter(
                                            (f) => f.id !== file.id,
                                          ),
                                        })
                                      }
                                    >
                                      {t("Удалить", "Жою")}
                                    </Button>
                                  </div>
                                ))}
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )
              }
            />
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="actions subject-appeal-actions">
            <small>
              {t(
                "Подписание выполняется в демонстрационном режиме.",
                "Қол қою демонстрациялық режимде орындалады.",
              )}
            </small>
            <Button onClick={onClose}>{t("Закрыть", "Жабу")}</Button>
            <Button
              disabled={uploading}
              onClick={() => {
                try {
                  onSave(draft);
                  setError("");
                } catch (cause) {
                  handleError(cause);
                }
              }}
            >
              {t("Сохранить черновик", "Жобаны сақтау")}
            </Button>
            {preview && (
              <>
                <Button
                  onClick={() =>
                    downloadFile(
                      "complaint.html",
                      subjectAppealHtml(source, draft, state.date),
                      "text/html;charset=utf-8",
                    )
                  }
                >
                  {t("Скачать документ", "Құжатты жүктеу")}
                </Button>
                <Button
                  onClick={() => {
                    try {
                      printSubjectAppeal(source, draft, state.date);
                    } catch (cause) {
                      handleError(cause);
                    }
                  }}
                >
                  {t("Печать / PDF", "Басып шығару / PDF")}
                </Button>
              </>
            )}
            <Button primary type="submit" disabled={uploading}>
              {t("Подписать и направить", "Қол қою және жіберу")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
