import { useMemo, useState } from "react";
import { Button, PageHeading } from "../../../components/ui";
import { CLOSED, STATUS, TYPES } from "../../../data/constants";
import type { CaseStatus, ObjectionCase, Role } from "../../../types";
import { formatDate } from "../../../utils/dateFormat";
import { executionDeadline, reviewDeadline } from "../services/deadlines";

const REQUEST_DIRECTION_STATUSES = [
  "accepted",
  "requested",
  "request_approval",
  "request_signed",
] as const;

const RESPONSE_WAITING_STATUSES = [
  "request_approved",
  "response_approval",
  "response_signed",
  "response_ready",
] as const;

const ANALYSIS_STATUSES = [
  "materials",
  "certificate_approval",
  "certificate_signed",
] as const;

const MEETING_STATUSES = [
  "certificate_approved",
  "documents_review",
  "commission_members",
  "commission_voting",
  "circulated",
  "meeting_certificate_approval",
  "meeting_certificate_signed",
  "meeting_certificate_approved",
] as const;

const HEARING_WAITING_STATUSES = [
  "decision_project",
  "decision_project_approval",
  "decision_project_signed",
  "decision_project_eotinish",
  "decision_project_hearing",
] as const;

const FINAL_RESPONSE_STATUSES = [
  "decided",
  "final_response_approval",
  "final_response_signed",
] as const;

function countCasesByStatus(
  cases: ObjectionCase[],
  statuses: readonly CaseStatus[],
) {
  return cases.filter((c) => statuses.includes(c.status)).length;
}

export default function CasesList({
  cases,
  date,
  role,
  onOpen,
  onCreate,
  onExport,
}: {
  cases: ObjectionCase[];
  date: string;
  role: Role;
  onOpen: (c: ObjectionCase) => void;
  onCreate: () => void;
  onExport: (cases: ObjectionCase[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [tab, setTab] = useState<
    | "all"
    | "incoming"
    | "request-direction"
    | "response-waiting"
    | "analysis"
    | "meeting"
    | "protocol-formation"
    | "protocol-signing"
    | "hearing-waiting"
    | "final-response"
  >("all");
  const incomingCount = cases.filter(
    (c) => c.status === "received" && c.channel === "SAQ" && c.unread,
  ).length;
  const requestDirectionCount = countCasesByStatus(
    cases,
    REQUEST_DIRECTION_STATUSES,
  );
  const responseWaitingCount = countCasesByStatus(
    cases,
    RESPONSE_WAITING_STATUSES,
  );
  const analysisCount = countCasesByStatus(cases, ANALYSIS_STATUSES);
  const meetingCount = countCasesByStatus(cases, MEETING_STATUSES);
  const protocolFormationCount = cases.filter((c) => c.status === "meeting").length;
  const protocolSigningCount = cases.filter((c) => c.status === "protocol").length;
  const hearingWaitingCount = countCasesByStatus(
    cases,
    HEARING_WAITING_STATUSES,
  );
  const finalResponseCount = countCasesByStatus(cases, FINAL_RESPONSE_STATUSES);
  const visible = useMemo(
    () =>
      cases.filter((c) => {
        const matchesQuery = `${c.id} ${c.org} ${c.bin}`
          .toLowerCase()
          .includes(query.toLowerCase());
        return (
          matchesQuery &&
          (type === "all" || c.type === type) &&
          (tab !== "incoming" ||
            (c.status === "received" && c.channel === "SAQ")) &&
          (tab !== "request-direction" ||
            REQUEST_DIRECTION_STATUSES.includes(
              c.status as (typeof REQUEST_DIRECTION_STATUSES)[number],
            )) &&
          (tab !== "response-waiting" ||
            RESPONSE_WAITING_STATUSES.includes(
              c.status as (typeof RESPONSE_WAITING_STATUSES)[number],
            )) &&
          (tab !== "analysis" ||
            ANALYSIS_STATUSES.includes(
              c.status as (typeof ANALYSIS_STATUSES)[number],
            )) &&
          (tab !== "meeting" ||
            MEETING_STATUSES.includes(
              c.status as (typeof MEETING_STATUSES)[number],
            )) &&
          (tab !== "protocol-formation" || c.status === "meeting") &&
          (tab !== "protocol-signing" || c.status === "protocol") &&
          (tab !== "hearing-waiting" ||
            HEARING_WAITING_STATUSES.includes(
              c.status as (typeof HEARING_WAITING_STATUSES)[number],
            )) &&
          (tab !== "final-response" ||
            FINAL_RESPONSE_STATUSES.includes(
              c.status as (typeof FINAL_RESPONSE_STATUSES)[number],
            ))
        );
      }),
    [cases, query, type, tab],
  );
  const stats = [
    [cases.length, "Всего обращений"],
    [cases.filter((c) => c.status === "received").length, "Поступило"],
    [
      cases.filter((c) => !CLOSED.includes(c.status) && c.status !== "received")
        .length,
      "На рассмотрении",
    ],
    [cases.filter((c) => CLOSED.includes(c.status)).length, "Завершено"],
  ];
  return (
    <>
      <PageHeading
        title="Реестр обращений"
        subtitle="Возражения объектов аудита и жалобы субъектов контроля"
        action={
          <>
            <Button onClick={() => onExport(visible)}>Экспорт CSV</Button>
            <Button primary onClick={onCreate}>
              + Новое обращение
            </Button>
          </>
        }
      />
      <div className="stats">
        {stats.map(([number, label]) => (
          <section className="stat" key={label}>
            <div>
              <strong className="stat-value">{number}</strong>
              <span className="stat-label">{label}</span>
            </div>
          </section>
        ))}
      </div>
      <section className="card">
        <div className="tabs registry-tabs">
          <button
            className={tab === "all" ? "active" : ""}
            type="button"
            onClick={() => setTab("all")}
          >
            Все
          </button>
          {(role === "director" || role === "work") && (
            <button
              className={tab === "incoming" ? "active" : ""}
              type="button"
              onClick={() => setTab("incoming")}
            >
              Новые
              {incomingCount > 0 && <span className="count">{incomingCount}</span>}
            </button>
          )}
          {(role === "work" || role === "director") && (
            <>
              <button
                className={tab === "request-direction" ? "active" : ""}
                type="button"
                onClick={() => setTab("request-direction")}
              >
                Направление запроса
                {requestDirectionCount > 0 && (
                  <span className="count">{requestDirectionCount}</span>
                )}
              </button>
              <button
                className={tab === "response-waiting" ? "active" : ""}
                type="button"
                onClick={() => setTab("response-waiting")}
              >
                Ответ на запрос
                {responseWaitingCount > 0 && (
                  <span className="count">{responseWaitingCount}</span>
                )}
              </button>
              <button
                className={tab === "analysis" ? "active" : ""}
                type="button"
                onClick={() => setTab("analysis")}
              >
                Анализ
                {analysisCount > 0 && <span className="count">{analysisCount}</span>}
              </button>
              <button
                className={tab === "meeting" ? "active" : ""}
                type="button"
                onClick={() => setTab("meeting")}
              >
                Заседание
                {meetingCount > 0 && <span className="count">{meetingCount}</span>}
              </button>
              <button
                className={tab === "protocol-formation" ? "active" : ""}
                type="button"
                onClick={() => setTab("protocol-formation")}
              >
                Формирование протокола
                {protocolFormationCount > 0 && (
                  <span className="count">{protocolFormationCount}</span>
                )}
              </button>
              <button
                className={tab === "protocol-signing" ? "active" : ""}
                type="button"
                onClick={() => setTab("protocol-signing")}
              >
                Подпись протокола
                {protocolSigningCount > 0 && (
                  <span className="count">{protocolSigningCount}</span>
                )}
              </button>
              <button
                className={tab === "hearing-waiting" ? "active" : ""}
                type="button"
                onClick={() => setTab("hearing-waiting")}
              >
                Заслушивание
                {hearingWaitingCount > 0 && (
                  <span className="count">{hearingWaitingCount}</span>
                )}
              </button>
              <button
                className={tab === "final-response" ? "active" : ""}
                type="button"
                onClick={() => setTab("final-response")}
              >
                Окончательный ответ
                {finalResponseCount > 0 && (
                  <span className="count">{finalResponseCount}</span>
                )}
              </button>
            </>
          )}
        </div>
        <div className="registry-filters">
          <label className="field">
            <span>Поиск</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Номер обращения, объект или БИН"
            />
          </label>
          <label className="field">
            <span>Предмет обращения</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="all">Все виды</option>
              {Object.entries(TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <span className="muted">Найдено: {visible.length}</span>
        </div>
        <div className="table-scroll">
          <table className="registry-table">
            <thead>
              <tr>
                <th>Обращение / поступление</th>
                <th>Объект</th>
                <th>Предмет обращения</th>
                <th>Статус</th>
                <th>Срок исполнения</th>
                <th>Срок рассмотрения</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const unread =
                  (role === "director" && c.unread) ||
                  (role === "work" && c.unreadForAssignee);
                return (
                <tr key={c.id} className={unread ? "unread-case" : ""}>
                  <td>
                    <button className="text-button" onClick={() => onOpen(c)}>
                      {c.id}
                    </button>
                    <span className="subline">{formatDate(c.registered)}</span>
                  </td>
                  <td>
                    <strong>{c.org}</strong>
                    <span className="subline">БИН {c.bin}</span>
                  </td>
                  <td>
                    {c.appealType ?? TYPES[c.type]}
                    <span className="subline">№ {c.document.number}</span>
                  </td>
                  <td>
                    <span
                      className={`badge ${CLOSED.includes(c.status) ? "green" : "blue"}`}
                    >
                      {STATUS[c.status]}
                    </span>
                  </td>
                  <td>
                    {(() => {
                      const deadline = executionDeadline(c);
                      return deadline ? (
                        <strong
                          className={
                            deadline < date && !CLOSED.includes(c.status)
                              ? "text-danger"
                              : ""
                          }
                        >
                          {formatDate(deadline)}
                        </strong>
                      ) : (
                        "—"
                      );
                    })()}
                  </td>
                  <td>
                    <strong
                      className={
                        reviewDeadline(c) < date && !CLOSED.includes(c.status)
                          ? "text-danger"
                          : ""
                      }
                    >
                      {c.status === "paused"
                        ? "Приостановлен"
                        : formatDate(reviewDeadline(c))}
                    </strong>
                  </td>
                  <td>
                    <Button onClick={() => onOpen(c)}>Открыть</Button>
                  </td>
                </tr>
                );
              })}
              {!visible.length && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <h3>Обращения не найдены</h3>
                      <p>Измените строку поиска или фильтры.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
