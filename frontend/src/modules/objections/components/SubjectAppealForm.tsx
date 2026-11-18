import { useRef, useState } from "react";
import { Button, Modal, Notice } from "../../../components/ui";
import type {
  DemoState,
  ObjectionCase,
  Role,
  SubjectAppealDraft,
  SubjectAuditReport,
} from "../../../types";
import { formatDate } from "../../../utils/dateFormat";
import { downloadFile } from "../../../utils/download";
import { auditProgramResultText } from "../services/auditProgramResults";
import {
  createSubjectAppealDraft,
  MAX_APPEAL_FILE_SIZE,
  subjectAuditReports,
  validateSubjectAppeal,
} from "../services/subjectAppeals";
import {
  printSubjectAppeal,
  SubjectAppealDocument,
  subjectAppealHtml,
} from "./SubjectAppealDocument";

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Не удалось сохранить обращение.";
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("Не удалось прочитать файл «" + file.name + "»."));
    reader.readAsDataURL(file);
  });
}

function newDraft(state: DemoState, report: SubjectAuditReport) {
  return structuredClone(
    state.subjectAppealDrafts?.find(
      (draft) =>
        draft.ownerRole === "subject2" &&
        draft.sourceCaseId === report.sourceCaseId,
    ) || createSubjectAppealDraft(report, crypto.randomUUID()),
  );
}

export default function SubjectAppealForm({
  state,
  role,
  draftId,
  onClose,
  onSave,
  onSubmit,
}: {
  state: DemoState;
  role: Role;
  draftId?: string;
  onClose: () => void;
  onSave: (draft: SubjectAppealDraft) => void;
  onSubmit: (draft: SubjectAppealDraft) => void;
}) {
  const reports = subjectAuditReports(state.cases, role);
  const [draft, setDraft] = useState<SubjectAppealDraft | undefined>(() => {
    const saved = state.subjectAppealDrafts?.find(
      (item) => item.id === draftId && item.ownerRole === role,
    );
    return saved
      ? structuredClone(saved)
      : reports[0]
        ? newDraft(state, reports[0])
        : undefined;
  });
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const sending = useRef(false);
  const report = reports.find(
    (item) => item.sourceCaseId === draft?.sourceCaseId,
  );
  const kk = draft?.language === "kk";
  const t = (ru: string, kz: string) => (kk ? kz : ru);
  async function addFiles(files: FileList | null, pointId?: string) {
    if (!files?.length || !draft) return;
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
          return {
            id: crypto.randomUUID(),
            name: file.name,
            size: file.size,
            dataUrl: await readFile(file),
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
      setError(message(cause));
    } finally {
      setUploading(false);
    }
  }
  const filesFor = (pointId?: string) =>
    draft?.attachments.filter((file) => file.pointId === pointId) || [];
  const fileInput = (pointId?: string) => (
    <div className="subject-appeal-upload">
      <label className="field">
        <span>
          {pointId
            ? t(
                "Документы, подтверждающие обстоятельства, на которых объект государственного аудита основывает свои требования, документы, имеющие отношение к возражению",
                "Мемлекеттік аудит объектісі өз талаптарын негіздейтін мән-жайларды растайтын құжаттар, қарсылыққа қатысты құжаттар",
              )
            : t(
                "Файлы доказательств к обращению",
                "Жолданымға дәлелдеме файлдары",
              )}
        </span>
        <input
          type="file"
          multiple
          disabled={uploading}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
          onChange={(event) => {
            void addFiles(event.currentTarget.files, pointId);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <small>
        {t(
          "Можно добавить несколько файлов, до 2 МБ каждый.",
          "Бірнеше файл қосуға болады, әрқайсысы 2 МБ-қа дейін.",
        )}
      </small>
      {filesFor(pointId).map((file) => (
        <div className="subject-appeal-file" key={file.id}>
          <span>{file.name}</span>
          <button
            type="button"
            className="text-button"
            aria-label={"Удалить " + file.name}
            onClick={() =>
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      attachments: current.attachments.filter(
                        (item) => item.id !== file.id,
                      ),
                    }
                  : current,
              )
            }
          >
            {t("Удалить", "Жою")}
          </button>
        </div>
      ))}
    </div>
  );
  return (
    <Modal
      title={t("Подать обращение", "Жолданым беру")}
      onClose={onClose}
      wide
    >
      {!draft || !report ? (
        <Notice tone="amber">
          В этом кабинете нет доступного аудиторского отчёта. Выберите отчёт,
          относящийся к объекту, перед подачей обращения.
        </Notice>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (sending.current || uploading) return;
            setError("");
            try {
              validateSubjectAppeal(draft, report);
              sending.current = true;
              onSubmit(draft);
            } catch (cause) {
              setError(message(cause));
              sending.current = false;
            }
          }}
        >
          <div className="subject-appeal-toolbar">
            <fieldset className="subject-appeal-language">
              <legend>
                Язык обращения <span className="required">*</span>
              </legend>
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
            <label className="field subject-appeal-report">
              <span>{t("Аудиторский отчёт", "Аудиторлық есеп")}</span>
              <select
                aria-label="Аудиторский отчёт"
                value={draft.sourceCaseId}
                disabled={uploading}
                onChange={(event) => {
                  const next = reports.find(
                    (item) => item.sourceCaseId === event.target.value,
                  );
                  if (next) {
                    setDraft(newDraft(state, next));
                    setError("");
                    setPreview(false);
                  }
                }}
              >
                {reports.map((item) => (
                  <option key={item.sourceCaseId} value={item.sourceCaseId}>
                    № {item.number} от {formatDate(item.date)}
                  </option>
                ))}
              </select>
            </label>
            <Button onClick={() => setPreview(!preview)}>
              {preview
                ? t("Вернуться к заполнению", "Толтыруға оралу")
                : t("Предпросмотр", "Алдын ала қарау")}
            </Button>
          </div>
          <div className="subject-appeal-paper-background">
            <SubjectAppealDocument
              report={report}
              draft={draft}
              date={state.date}
              onChange={preview ? undefined : setDraft}
              pointEditor={
                preview ? undefined : (
                  <div className="subject-appeal-point-editor">
                    <div className="subject-appeal-point-heading">
                      <span>
                        {t("Выбрано:", "Таңдалды:")}{" "}
                        {draft.selectedPointIds.length}
                      </span>
                    </div>
                    <p className="subject-appeal-hint">
                      {t(
                        "Выберите пункты этого отчёта. Описание подставляется автоматически, довод и доказательства добавьте по каждому выбранному пункту.",
                        "Осы есептің тармақтарын таңдаңыз. Сипаттама автоматты түрде толтырылады; әр таңдалған тармақ бойынша уәж бен дәлелдемелерді қосыңыз.",
                      )}
                    </p>
                    {report.points.map((point) => {
                      const selected = draft.selectedPointIds.includes(
                        point.id,
                      );
                      return (
                        <section
                          className={
                            "subject-appeal-point" +
                            (selected ? " selected" : "")
                          }
                          key={point.id}
                        >
                          <label className="subject-appeal-point-toggle">
                            <input
                              type="checkbox"
                              checked={selected}
                              aria-label={"Оспорить пункт " + point.number}
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
                                        (file) => file.pointId !== point.id,
                                      ),
                                })
                              }
                            />
                            <span>
                              <b>
                                {t(
                                  "Вопрос программы аудита",
                                  "Аудит бағдарламасының сұрағы",
                                )}{" "}
                                № {point.number}
                              </b>
                              <span>
                                {(kk ? point.titleKk : point.titleRu) ||
                                  point.title}
                              </span>
                            </span>
                          </label>
                          {selected && (
                            <div className="subject-appeal-point-body">
                              <div className="subject-appeal-source-answer">
                                <b>
                                  {t(
                                    "Нарушение, по которому поступило возражение",
                                    "Қарсылық келіп түскен бұзушылық",
                                  )}
                                </b>
                                <p>
                                  {auditProgramResultText(
                                    point.auditProgramResult,
                                    "answer",
                                    draft.language,
                                    true,
                                  ) ||
                                    t(
                                      "Ответ на вопрос программы аудита не передан из ВГА.",
                                      "Аудит бағдарламасының сұрағына жауап ІМА модулінен берілмеген.",
                                    )}
                                </p>
                                <small>
                                  {t(
                                    "Из поля «Ответ на вопрос программы аудита» аудиторского отчёта. Заполняется автоматически.",
                                    "Аудиторлық есептің «Аудит бағдарламасының сұрағына жауап» өрісінен автоматты түрде толтырылады.",
                                  )}
                                </small>
                              </div>
                              <label className="field">
                                <span>
                                  {t(
                                    "Обстоятельства, на которые объект государственного аудита, подающий возражение, основывает свои требования, и доказательства, подтверждающие эти обстоятельства",
                                    "Қарсылық беруші мемлекеттік аудит объектісі өз талаптарын негіздейтін мән-жайлар және осы мән-жайларды растайтын дәлелдемелер",
                                  )}{" "}
                                  <span className="required">*</span>
                                </span>
                                <textarea
                                  aria-label={
                                    "Обстоятельства по пункту " + point.number
                                  }
                                  value={draft.argumentsByPoint[point.id] || ""}
                                  required
                                  rows={4}
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
                              {fileInput(point.id)}
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )
              }
              attachmentsEditor={
                <div className="subject-appeal-point-editor">
                  {fileInput()}
                  <small>
                    {t(
                      "Перечень формируется из названий приложенных файлов доказательств, в том числе по выбранным вопросам.",
                      "Тізім тіркелген дәлелдеме файлдарының, соның ішінде таңдалған мәселелер бойынша файлдардың атауларынан құрылады.",
                    )}
                  </small>
                </div>
              }
            />
          </div>
          {uploading && <p role="status">Сохранение файлов…</p>}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="subject-appeal-actions dialog-actions">
            <small>
              {t(
                "Подписание в макете выполняется в демонстрационном режиме.",
                "Макетте қол қою демонстрациялық режимде орындалады.",
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
                  setError(message(cause));
                }
              }}
            >
              {t("Сохранить черновик", "Жобаны сақтау")}
            </Button>
            <Button primary type="submit" disabled={uploading}>
              {t("Подписать и направить", "Қол қою және жіберу")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function SubjectAppealsPanel({
  drafts,
  submitted,
  onContinue,
  onView,
}: {
  drafts: SubjectAppealDraft[];
  submitted: ObjectionCase[];
  onContinue: (id: string) => void;
  onView: (id: string) => void;
}) {
  if (!drafts.length && !submitted.length) return null;
  return (
    <section className="card subject-appeal-registry">
      <h3>Мои обращения</h3>
      {drafts.map((draft) => (
        <div className="subject-appeal-registry-row" key={draft.id}>
          <div>
            <b>Черновик обращения</b>
            <small>
              {draft.language === "kk" ? "Қазақша" : "Русский"} · Не направлено
            </small>
          </div>
          <Button onClick={() => onContinue(draft.id)}>
            Продолжить заполнение
          </Button>
        </div>
      ))}
      {submitted.map((c) => (
        <div className="subject-appeal-registry-row" key={c.id}>
          <div>
            <b>
              {c.id} · Аудиторский отчёт № {c.subjectAppeal!.report.number}
            </b>
            <small>
              Направлено {formatDate(c.registered)} ·{" "}
              {c.status === "received"
                ? "Ожидает назначения исполнителя"
                : "На рассмотрении"}
            </small>
          </div>
          <Button onClick={() => onView(c.id)}>Поданное обращение</Button>
        </div>
      ))}
    </section>
  );
}

export function SubjectAppealReceipt({
  c,
  onClose,
}: {
  c: ObjectionCase;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const saved = c.subjectAppeal!;
  return (
    <Modal title={"Поданное обращение " + c.id} onClose={onClose} wide>
      <Notice tone="green">
        Обращение зарегистрировано {formatDate(c.registered)}. Номер: {c.id}.
      </Notice>
      <div className="subject-appeal-receipt-tools">
        <Button
          onClick={() =>
            downloadFile(
              c.id + ".html",
              subjectAppealHtml(
                saved.report,
                saved.draft,
                saved.submittedAt,
                true,
              ),
              "text/html;charset=utf-8",
            )
          }
        >
          Скачать документ
        </Button>
        <Button
          primary
          onClick={() => {
            try {
              printSubjectAppeal(
                saved.report,
                saved.draft,
                saved.submittedAt,
                true,
              );
            } catch (cause) {
              setError(message(cause));
            }
          }}
        >
          Печать / PDF
        </Button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <SubjectAppealDocument
        report={saved.report}
        draft={saved.draft}
        date={saved.submittedAt}
        submitted
      />
      {saved.draft.attachments.length > 0 && (
        <section className="subject-appeal-receipt-files">
          <h3>Вложения</h3>
          {saved.draft.attachments.map((file) => (
            <a key={file.id} href={file.dataUrl} download={file.name}>
              {file.name}
            </a>
          ))}
        </section>
      )}
    </Modal>
  );
}
