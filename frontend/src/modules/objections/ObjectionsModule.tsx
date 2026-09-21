import { useState } from "react";
import AppShell from "../../components/AppShell";
import { Button, Modal, Notice } from "../../components/ui";
import { initialState } from "../../api/objectionsRepository";
import { DEMO_USER } from "../../config";
import { ROLES } from "../../data/constants";
import { COMMISSION_ATTENDANCE_MEMBERS } from "../../data/objections";
import type {
  Action,
  CaseDocument,
  ObjectionCase,
} from "../../types";
import { caseCsv, downloadFile } from "../../utils/download";
import ActionModal, { Field } from "./components/ActionModal";
import AgendaModal, { agendaDocumentHtml } from "./components/AgendaModal";
import AgendaResultsModal from "./components/AgendaResultsModal";
import DocumentModal from "./components/DocumentModal";
import NewCaseModal from "./components/NewCaseModal";
import CasesList from "./pages/CasesList";
import CaseWorkspace from "./pages/CaseWorkspace";
import NotificationsPage from "./pages/NotificationsPage";
import {
  ProcessesPage,
  SessionsPage,
  SourcesPage,
} from "./pages/ReferencePages";
import { dateObject } from "./services/deadlines";
import { applyAction } from "./services/workflow";
import { useObjectionsModel } from "./useObjectionsModel";
import { formatDateTime } from "../../utils/dateFormat";

type DialogState =
  | { type: "action"; action: Action }
  | { type: "document"; kind: string; document?: CaseDocument }
  | { type: "agenda"; cases: ObjectionCase[] }
  | { type: "agenda-results"; agendaId: string }
  | { type: "attendance"; cases: ObjectionCase[] }
  | { type: "attendance-answer"; pollId: string }
  | { type: "new" | "clock" | "reset" | "upload" }
  | null;

export default function ObjectionsModule() {
  const model = useObjectionsModel();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogError, setDialogError] = useState("");
  const [uploading, setUploading] = useState(false);
  const c = model.state.cases.find((item) => item.id === model.route.caseId);
  const activeCommissionMember = COMMISSION_ATTENDANCE_MEMBERS.find(
    (member) => member.id === model.state.activeCommissionMemberId,
  ) || COMMISSION_ATTENDANCE_MEMBERS[0];
  const commissionCanOpenCase = (caseId: string) =>
    model.state.attendancePolls.some(
      (poll) =>
        poll.caseIds.includes(caseId) &&
        poll.responses[activeCommissionMember.id] === "yes",
    );
  const close = () => {
    setDialog(null);
    setDialogError("");
  };
  const openCase = (c: ObjectionCase) => {
    if (model.role === "commission" && !commissionCanOpenCase(c.id)) {
      model.setToast(
        "Карточка станет доступна после подтверждения присутствия на заседании.",
      );
      return;
    }
    const shouldMarkRead =
      (model.role === "director" && c.unread) ||
      (model.role === "work" && c.unreadForAssignee);
    if (shouldMarkRead) {
      const next = structuredClone(model.state);
      const target = next.cases.find((item) => item.id === c.id)!;
      if (model.role === "director") target.unread = false;
      if (model.role === "work") target.unreadForAssignee = false;
      model.commit(next, "");
    }
    model.navigate({ page: "detail", caseId: c.id, tab: "review" });
  };
  const openNotifications = () => {
    if (model.state.notifications.some((notification) => !notification.read)) {
      const next = structuredClone(model.state);
      next.notifications.forEach((notification) => {
        notification.read = true;
      });
      model.commit(next, "");
    }
    model.navigate({ page: "notifications" });
  };
  const setActiveCommissionMember = (memberId: string) => {
    model.commit(
      { ...model.state, activeCommissionMemberId: memberId },
      "",
    );
  };
  const sendAttendancePoll = (cases: ObjectionCase[], dateTime: string) => {
    if (!cases.length || !dateTime) return;
    const next = structuredClone(model.state);
    const pollId = `attendance-${next.attendancePolls.length + 1}`;
    const responses = Object.fromEntries(
      COMMISSION_ATTENDANCE_MEMBERS.map((member) => [member.id, "pending"]),
    ) as Record<string, "pending" | "yes" | "no">;
    next.attendancePolls.push({
      id: pollId,
      dateTime,
      caseIds: cases.map((item) => item.id),
      sentAt: next.date,
      responses,
      manualResponseChanges: {},
    });
    COMMISSION_ATTENDANCE_MEMBERS.forEach((member) => {
      next.notifications.push({
        id: `${pollId}-${member.id}`,
        caseId: cases[0].id,
        recipient: member.name,
        text: `Укажите, будете ли присутствовать на заседании ${formatDateTime(dateTime)}.`,
        date: next.date,
        read: false,
        kind: "attendance-poll",
        attendancePollId: pollId,
        commissionMemberId: member.id,
      });
    });
    cases.forEach((item) => {
      const target = next.cases.find((caseItem) => caseItem.id === item.id);
      target?.history.push({
        date: next.date,
        actor: ROLES.work,
        title: "Направлен опрос о присутствии на заседании",
        text: `Дата и время заседания: ${formatDateTime(dateTime)}. Опрос направлен членам АК и их и.о.`,
      });
    });
    model.commit(next, "Опрос о присутствии направлен членам АК и их и.о.");
    close();
  };
  const answerAttendancePoll = (
    pollId: string,
    response: "yes" | "no",
  ) => {
    const next = structuredClone(model.state);
    const poll = next.attendancePolls.find((item) => item.id === pollId);
    if (!poll) return;
    poll.responses[activeCommissionMember.id] = response;
    next.notifications.forEach((notification) => {
      if (
        notification.attendancePollId === pollId &&
        notification.commissionMemberId === activeCommissionMember.id
      ) {
        notification.read = true;
      }
    });
    poll.caseIds.forEach((caseId) => {
      const target = next.cases.find((item) => item.id === caseId);
      target?.history.push({
        date: next.date,
        actor: activeCommissionMember.name,
        title: response === "yes" ? "Подтверждено присутствие" : "Отказ от участия в заседании",
        text: `Ответ на опрос о заседании ${formatDateTime(poll.dateTime)}: ${response === "yes" ? "Да" : "Нет"}.`,
      });
    });
    model.commit(
      next,
      response === "yes"
        ? "Присутствие подтверждено. Карточки обращений открыты."
        : "Отказ от участия сохранён. Карточки обращений недоступны.",
    );
    close();
  };
  const updateAttendanceResponse = (
    pollId: string,
    memberId: string,
    response: "yes" | "no",
  ) => {
    const member = COMMISSION_ATTENDANCE_MEMBERS.find(
      (item) => item.id === memberId,
    );
    const next = structuredClone(model.state);
    const poll = next.attendancePolls.find((item) => item.id === pollId);
    if (!poll || !member) return;
    poll.responses[memberId] = response;
    poll.manualResponseChanges ??= {};
    poll.manualResponseChanges[memberId] = {
      changedBy: DEMO_USER.fullName,
      changedAt: next.date,
    };
    next.notifications.forEach((notification) => {
      if (
        notification.attendancePollId === pollId &&
        notification.commissionMemberId === memberId
      ) {
        notification.read = true;
      }
    });
    poll.caseIds.forEach((caseId) => {
      const target = next.cases.find((item) => item.id === caseId);
      target?.history.push({
        date: next.date,
        actor: ROLES.work,
        title: "Статус присутствия отмечен рабочим органом",
        text: `${member.name}: ${response === "yes" ? "Да" : "Нет"}.`,
      });
    });
    model.commit(
      next,
      `Статус участия члена АК «${member.name}» сохранён.`,
    );
  };
  const openAgendaCase = (caseId: string) => {
    const target = model.state.cases.find((item) => item.id === caseId);
    if (target) openCase(target);
  };
  const previewWordDocument = (title: string, html: string) => {
    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.document.title = title;
    popup.document.write(html);
    popup.document.close();
  };
  const downloadWordDocument = (name: string, html: string) =>
    downloadFile(name, html, "application/msword;charset=utf-8");

  async function upload(file?: File) {
    if (!file || !c) return;
    setDialogError("");
    if (file.size > 2 * 1024 * 1024) {
      setDialogError("Максимальный размер файла — 2 МБ");
      return;
    }
    if (!/\.(pdf|png|jpe?g|docx?|xlsx?|txt)$/i.test(file.name)) {
      setDialogError("Поддерживаются PDF, PNG, JPG, DOC(X), XLS(X), TXT");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
        reader.readAsDataURL(file);
      });
      const next = structuredClone(model.state);
      const updated = next.cases.find((item) => item.id === c.id)!;
      updated.documents.push({
        name: file.name,
        filename: file.name,
        kind: "attachment",
        text: "Приложенный материал",
        author: ROLES[model.role],
        date: next.date,
        dataUrl,
      });
      updated.history.push({
        date: next.date,
        actor: ROLES[model.role],
        title: "Добавлен материал",
        text: file.name,
      });
      model.commit(next, "Материал добавлен. Срок рассмотрения не изменён.");
      close();
    } catch (cause) {
      setDialogError(
        cause instanceof Error
          ? cause.message
          : "Недостаточно места для сохранения вложения",
      );
    } finally {
      setUploading(false);
    }
  }

  async function submitAction(action: Action, form: FormData) {
    if (!c) return;
    if (
      !["position", "fill-request-response", "request", "request-other"].includes(
        action,
      )
    ) {
      model.perform(c.id, action, form);
      return;
    }
    const files = form
      .getAll(
        ["request", "request-other"].includes(action)
          ? "requestAttachments"
          : "responseFiles",
      )
      .filter(
        (item): item is File => item instanceof File && item.name.length > 0,
      );
    if (action === "position" && !files.length)
      throw new Error("Вложите хотя бы один полученный файл");
    for (const file of files) {
      if (file.size > 2 * 1024 * 1024)
        throw new Error(`Файл «${file.name}» превышает 2 МБ`);
      if (!/\.(pdf|png|jpe?g|docx?|xlsx?|txt)$/i.test(file.name))
        throw new Error("Поддерживаются PDF, PNG, JPG, DOC(X), XLS(X), TXT");
    }
    const attached = await Promise.all(
      files.map(
        (file) =>
          new Promise<{ file: File; dataUrl: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ file, dataUrl: String(reader.result) });
            reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
            reader.readAsDataURL(file);
          }),
      ),
    );
    const responseRequestIdBeforeAction =
      action === "fill-request-response"
        ? c.requests.find(
            (request) =>
              !request.responded &&
              request.template !== "other" &&
              (model.role !== "dvga" && model.role !== "kvga" ||
                (model.role === "kvga"
                  ? request.recipient.toUpperCase().includes("КВГА")
                  : request.recipient.toUpperCase().includes("ДВГА"))),
          )?.id
        : action === "position"
          ? c.requests.find(
              (request) => request.responded && !request.confirmed,
            )?.id ||
            c.requests.find(
              (request) => !request.responded && request.template === "other",
            )?.id
          : undefined;
    const next = applyAction(model.state, c.id, action, model.role, form);
    const updated = next.cases.find((item) => item.id === c.id)!;
    const responseRequestId =
      ["request", "request-other"].includes(action)
        ? updated.requests.at(-1)?.id
        : responseRequestIdBeforeAction;
    if (attached.length) {
      updated.documents.push(
        ...attached.map(({ file, dataUrl }) => ({
          name: file.name,
          filename: file.name,
          kind:
            ["request", "request-other"].includes(action)
              ? "request-attachment"
              : action === "fill-request-response"
              ? "authority-response-attachment"
              : "response-attachment",
          text:
            ["request", "request-other"].includes(action)
              ? "Приложение исполнителя рабочего органа к запросу"
              : action === "fill-request-response"
              ? "Подтверждающий документ ДВГА/КВГА"
              : "Полученный ответ на запрос",
          author: ROLES[model.role],
          date: next.date,
          dataUrl,
          requestId: responseRequestId,
        })),
      );
      updated.history.push({
        date: next.date,
        actor: ROLES[model.role],
        title:
          ["request", "request-other"].includes(action)
            ? "Вложены приложения к запросу"
            : action === "fill-request-response"
            ? "Вложены документы ДВГА/КВГА"
            : "Вложены полученные файлы",
        text: attached.map(({ file }) => file.name).join(", "),
      });
    }
    model.commit(
      next,
      ["request", "request-other"].includes(action)
        ? attached.length
          ? "Запрос и приложения сохранены"
          : "Запрос сохранён"
        : action === "fill-request-response"
        ? "Ответ ДВГА/КВГА и вложения сохранены"
        : "Полученный ответ и вложения сохранены",
    );
  }

  return (
    <AppShell
      route={model.route}
      date={model.state.date}
      role={model.role}
      unreadNotifications={model.state.notifications.filter(
        (notification) =>
          !notification.read &&
          (model.role !== "commission" ||
            notification.commissionMemberId === activeCommissionMember.id),
      ).length}
      onRoleChange={model.setRole}
      onNavigate={(next) =>
        next.page === "notifications" ? openNotifications() : model.navigate(next)
      }
      onClock={() => setDialog({ type: "clock" })}
      onReset={() => setDialog({ type: "reset" })}
      activeCommissionMember={activeCommissionMember}
      commissionMembers={COMMISSION_ATTENDANCE_MEMBERS}
      onCommissionMemberChange={setActiveCommissionMember}
    >
      {model.error && <Notice tone="amber">{model.error}</Notice>}
      {model.route.page === "registry" && (
        <CasesList
          cases={
            model.role === "commission"
              ? model.state.cases.filter((item) => commissionCanOpenCase(item.id))
              : model.state.cases
          }
          date={model.state.date}
          role={model.role}
          onOpen={openCase}
          onCreate={() => setDialog({ type: "new" })}
          onExport={(cases) =>
            downloadFile(
              "saq-objections.csv",
              caseCsv(cases),
              "text/csv;charset=utf-8",
            )
          }
        />
      )}
      {model.route.page === "detail" &&
        (c ? (
          model.role === "commission" && !commissionCanOpenCase(c.id) ? (
            <Notice tone="amber">
              Карточка обращения доступна члену АК только после ответа «Да» в
              опросе о присутствии на заседании.
            </Notice>
          ) : (
          <CaseWorkspace
            c={c}
            tab={model.route.tab || "review"}
            role={model.role}
            onBack={() => model.navigate({ page: "registry" })}
            onTab={(tab) => model.navigate({ ...model.route, tab })}
            onAction={(action, role) => {
              if (
                action === "assign-work-executor" ||
                action === "choose-commission-members" ||
                action === "commission-vote" ||
                action === "vote"
              ) {
                model.setRole(role);
                setDialog({ type: "action", action });
                return;
              }
              if (
                action === "screen" ||
                action === "send-request-approval" ||
                action === "approve-request" ||
                action === "sign-request" ||
                action === "approve-response" ||
                action === "sign-response" ||
                action === "approve-certificate" ||
                action === "sign-certificate" ||
                action === "send-certificate-to-commission" ||
                action === "review-commission-documents" ||
                action === "members" ||
                action === "sign"
              ) {
                const form = new FormData();
                if (action === "screen") {
                  form.set("identity", "on");
                  form.set("document", "on");
                  form.set("grounds", "on");
                  form.set("competence", "on");
                  form.set(
                    "assignee",
                    c.assignee === "Не назначен"
                      ? "Исполнитель ДАВГА"
                      : c.assignee,
                  );
                  form.set("authority", c.authority);
                  form.set(
                    "basis",
                    "Реквизиты обращения проверены, обращение принято к рассмотрению.",
                  );
                  if (c.type === "control")
                    form.set(
                      "actEffect",
                      "Обращение принято к рассмотрению в общем порядке.",
                    );
                }
                if (action === "approve-request") {
                  form.set("approved", "on");
                }
                if (action === "members") {
                  form.set("meetingConducted", "on");
                }
                if (action === "sign") {
                  form.set("secretary", "on");
                  c.members
                    .filter((member) => member.present)
                    .forEach((member) =>
                      form.set(`signed_${member.id}`, "on"),
                    );
                  form.set(
                    "reason",
                    "Результаты голосования членов АК зафиксированы в протоколе.",
                  );
                }
                const next = applyAction(
                  model.state,
                  c.id,
                  action,
                  role,
                  form,
                );
                model.commit(
                  next,
                  action === "screen"
                    ? "Обращение принято к рассмотрению"
                    : action === "approve-request"
                    ? "Запрос согласован"
                    : action === "sign-request"
                      ? "Запрос подписан"
                    : action === "approve-response"
                      ? "Ответ ДВГА/КВГА согласован"
                    : action === "sign-response"
                      ? "Ответ ДВГА/КВГА подписан"
                    : action === "approve-certificate"
                      ? "Справка согласована"
                      : action === "sign-certificate"
                        ? "Справка подписана"
                      : action === "send-certificate-to-commission"
                        ? "Справка и документы направлены членам АК"
                        : action === "review-commission-documents"
                          ? "Члены АК ознакомились с документами"
                        : action === "members"
                          ? "Заседание по данному делу проведено"
                        : action === "sign"
                          ? "Протокол подписан"
                        : "Запрос направлен на согласование",
                );
                return;
              }
              model.setRole(role);
              setDialog({ type: "action", action });
            }}
            onDocument={(kind, document) =>
              setDialog({ type: "document", kind, document })
            }
            onUpload={() => setDialog({ type: "upload" })}
          />
          )
        ) : (
          <Notice>
            Обращение не найдено в этом браузере.{" "}
            <button
              className="text-button"
              onClick={() => model.navigate({ page: "registry" })}
            >
              Открыть реестр
            </button>
          </Notice>
        ))}
      {model.route.page === "sessions" && (
        <SessionsPage
          cases={model.state.cases}
          agendas={model.state.agendas}
          onOpen={openCase}
          onAgenda={(cases) => setDialog({ type: "agenda", cases })}
          onOpenAgendaCase={openAgendaCase}
          onPreviewAgenda={(agenda) =>
            previewWordDocument(`Повестка дня №${agenda.number}`, agenda.documentHtml)
          }
          onDownloadAgenda={(agenda) =>
            downloadWordDocument(
              `Повестка-дня-${agenda.number}.doc`,
              agenda.documentHtml,
            )
          }
          onGenerateAgendaResults={(agenda) =>
            setDialog({ type: "agenda-results", agendaId: agenda.id })
          }
          onPreviewAgendaResults={(agenda) =>
            previewWordDocument(
              `Итоги по повестке дня №${agenda.number}`,
              agenda.resultsHtml!,
            )
          }
          onDownloadAgendaResults={(agenda) =>
            downloadWordDocument(
              `Итоги-по-повестке-${agenda.number}.doc`,
              agenda.resultsHtml!,
            )
          }
          onAttendancePoll={(cases) => setDialog({ type: "attendance", cases })}
          attendancePolls={model.state.attendancePolls}
          commissionMembers={COMMISSION_ATTENDANCE_MEMBERS}
          onUpdateAttendanceResponse={updateAttendanceResponse}
          role={model.role}
        />
      )}
      {model.route.page === "notifications" && (
        <NotificationsPage
          notifications={model.state.notifications}
          role={model.role}
          activeCommissionMemberId={activeCommissionMember.id}
          onAnswerAttendancePoll={(pollId) =>
            setDialog({ type: "attendance-answer", pollId })
          }
          onOpenCase={(caseId) => {
            const target = model.state.cases.find((item) => item.id === caseId);
            if (target) openCase(target);
          }}
        />
      )}
      {model.route.page === "processes" && <ProcessesPage />}
      {model.route.page === "sources" && <SourcesPage />}
      {dialog?.type === "action" && c && (
        <ActionModal
          key={`${c.id}-${dialog.action}`}
          action={dialog.action}
          c={c}
          date={model.state.date}
          role={model.role}
          onClose={close}
          onSubmit={(form) => submitAction(dialog.action, form)}
        />
      )}
      {dialog?.type === "document" && c && (
        <DocumentModal
          c={c}
          kind={dialog.kind}
          document={dialog.document}
          onClose={close}
        />
      )}
      {dialog?.type === "agenda" && (
        <AgendaModal
          cases={dialog.cases}
          date={model.state.date}
          onSend={(meetingDate) => {
            const selectedIds = new Set(dialog.cases.map((item) => item.id));
            const next = structuredClone(model.state);
            next.cases
              .filter((item) => selectedIds.has(item.id))
              .forEach((item) => {
                item.agendaMeetingDate = meetingDate;
                item.history.push({
                  date: next.date,
                  actor: ROLES[model.role],
                  title: "Повестка дня направлена членам АК",
                  text: `Дата заседания: ${meetingDate}`,
                });
              });
            const number =
              Math.max(0, ...next.agendas.map((agenda) => agenda.number)) + 1;
            next.agendas.push({
              id: `agenda-${number}`,
              number,
              meetingDate,
              caseIds: dialog.cases.map((item) => item.id),
              documentHtml: agendaDocumentHtml(dialog.cases, meetingDate),
              created: next.date,
            });
            model.commit(next, "Повестка дня направлена членам АК");
            close();
          }}
          onClose={close}
        />
      )}
      {dialog?.type === "attendance" && (
        <Modal title="Опрос о присутствии на заседании" onClose={close}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const dateTime = String(
                new FormData(event.currentTarget).get("dateTime") || "",
              );
              if (!dateTime) {
                setDialogError("Укажите дату и время проведения заседания");
                return;
              }
              sendAttendancePoll(dialog.cases, dateTime);
            }}
          >
            <p>
              Опрос будет направлен всем членам Апелляционной комиссии и
              лицам, исполняющим их обязанности, по выбранным обращениям.
            </p>
            <label className="field">
              <span>
                Дата и время проведения заседания <b className="required">*</b>
              </span>
              <input
                name="dateTime"
                type="datetime-local"
                required
                defaultValue={`${model.state.date}T10:00`}
              />
            </label>
            {dialogError && <p className="form-error">{dialogError}</p>}
            <div className="dialog-actions">
              <Button onClick={close}>Отмена</Button>
              <Button primary type="submit">
                Направить опрос
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {dialog?.type === "attendance-answer" && (() => {
        const poll = model.state.attendancePolls.find(
          (item) => item.id === dialog.pollId,
        );
        if (!poll) return null;
        const answer = poll.responses[activeCommissionMember.id];
        return (
          <Modal title="Подтвердите присутствие" onClose={close}>
            <p>
              {`Укажите, будете ли присутствовать на заседании ${formatDateTime(poll.dateTime)}.`}
            </p>
            <p className="muted">Член АК: {activeCommissionMember.name}</p>
            <div className="dialog-actions">
              <Button onClick={close}>Отмена</Button>
              <Button
                className={answer === "no" ? "attendance-choice-active" : ""}
                onClick={() => answerAttendancePoll(poll.id, "no")}
              >
                Нет
              </Button>
              <Button
                primary
                className={answer === "yes" ? "attendance-choice-active" : ""}
                onClick={() => answerAttendancePoll(poll.id, "yes")}
              >
                Да
              </Button>
            </div>
          </Modal>
        );
      })()}
      {dialog?.type === "agenda-results" && (() => {
        const agenda = model.state.agendas.find(
          (item) => item.id === dialog.agendaId,
        );
        if (!agenda) return null;
        const agendaCases = agenda.caseIds
          .map((caseId) => model.state.cases.find((item) => item.id === caseId))
          .filter((item): item is ObjectionCase => Boolean(item));
        return (
          <AgendaResultsModal
            cases={agendaCases}
            meetingDate={agenda.meetingDate}
            onGenerate={(html) => {
              const next = structuredClone(model.state);
              const target = next.agendas.find((item) => item.id === agenda.id);
              if (!target) return;
              target.resultsHtml = html;
              model.commit(next, "Итоги по повестке дня сформированы");
              close();
            }}
            onClose={close}
          />
        );
      })()}
      {dialog?.type === "new" && (
        <NewCaseModal
          state={model.state}
          onClose={close}
          onSave={(next, caseId) => {
            model.commit(next, "Тестовое обращение зарегистрировано");
            model.navigate({ page: "detail", caseId });
          }}
        />
      )}
      {dialog?.type === "clock" && (
        <Modal title="Дата демонстрации" onClose={close}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              try {
                const date = String(
                  new FormData(event.currentTarget).get("date"),
                );
                dateObject(date);
                const minimum = [
                  model.state.date,
                  ...model.state.cases.flatMap((item) =>
                    item.history.map((event) => event.date),
                  ),
                ]
                  .sort()
                  .at(-1)!;
                if (date < minimum || date > "2026-12-31")
                  throw new Error(
                    `Дата должна быть не раньше ${minimum} и не позже 31.12.2026`,
                  );
                model.commit({ ...model.state, date }, "Дата демо изменена");
                close();
              } catch (cause) {
                setDialogError(
                  cause instanceof Error ? cause.message : "Проверьте дату",
                );
              }
            }}
          >
            <Notice>
              Изменение даты помогает показать этапы с обязательными
              интервалами. Даты уже зарегистрированных событий сохраняются.
            </Notice>
            <Field
              field={{
                name: "date",
                label: "Рабочая дата",
                type: "date",
                value: model.state.date,
                required: true,
              }}
            />
            {dialogError && (
              <p className="form-error" role="alert">
                {dialogError}
              </p>
            )}
            <div className="dialog-actions">
              <Button onClick={close}>Отмена</Button>
              <Button primary type="submit">
                Изменить дату
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {dialog?.type === "reset" && (
        <Modal title="Перезапустить демонстрацию" onClose={close}>
          <p>
            Три исходных обращения будут восстановлены. Действия и вложения,
            добавленные в этом браузере, будут удалены.
          </p>
          {dialogError && <p className="form-error">{dialogError}</p>}
          <div className="dialog-actions">
            <Button onClick={close}>Отмена</Button>
            <Button
              primary
              onClick={() => {
                try {
                  model.commit(
                    initialState(),
                    "Три исходных обращения восстановлены",
                  );
                  model.navigate({ page: "registry" });
                  close();
                } catch {
                  setDialogError("Браузер не разрешает сохранение данных");
                }
              }}
            >
              Сбросить демо
            </Button>
          </div>
        </Modal>
      )}
      {dialog?.type === "upload" && (
        <Modal title="Добавить материал дела" onClose={close}>
          <Notice>
            Обычное вложение не продлевает срок рассмотрения. Формальное
            дополнение регистрируется отдельным действием.
          </Notice>
          <label className="field">
            <span>Файл — до 2 МБ</span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt"
              disabled={uploading}
              onChange={(event) => void upload(event.target.files?.[0])}
            />
          </label>
          {uploading && <p>Сохранение файла…</p>}
          {dialogError && (
            <p className="form-error" role="alert">
              {dialogError}
            </p>
          )}
        </Modal>
      )}
      {model.toast && (
        <div className="react-toast" role="status">
          {model.toast}
        </div>
      )}
    </AppShell>
  );
}
