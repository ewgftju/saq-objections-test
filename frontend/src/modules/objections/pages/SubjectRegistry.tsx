import { useState } from "react";
import { Button, PageHeading } from "../../../components/ui";
import { TYPES } from "../../../data/constants";
import { formatDate } from "../../../utils/dateFormat";
import { downloadFile } from "../../../utils/download";
import { requestNumber } from "../services/requestNumbering";
import { authorityRequestStatusLabel } from "../services/statusPresentation";
import {
  isApplicantCase,
  isSubjectRequest,
  subjectCaseStatus,
} from "../services/subjectRegistry";
import type { CasesListProps } from "./CasesList";

export default function SubjectRegistry(props: CasesListProps) {
  const {
    cases,
    role,
    onOpen,
    onExport,
    onCreateSubjectAppeal,
    subjectDrafts = [],
    onContinueSubjectAppeal,
    onOpenSubjectRequest,
  } = props;
  const [localTab, setLocalTab] = useState<"appeals" | "requests">("appeals");
  const tab = props.subjectRegistryTab ?? localTab;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [appealType, setAppealType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const ownCases = cases.filter((c) => isApplicantCase(c, role));
  const drafts = subjectDrafts.filter((draft) => draft.ownerRole === role);
  const requests = cases.flatMap((c) =>
    c.requests
      .filter((request) => isSubjectRequest(c, request, role))
      .map((request) => ({ c, request })),
  );
  const pendingCount = requests.filter(
    ({ request }) => !request.responded && !request.responseSigned,
  ).length;
  const appeals = [
    ...drafts.map((draft) => ({
      key: draft.id,
      date: draft.savedAt || "",
      status: "Черновик",
      search: "Черновик " + (draft.savedAt || ""),
      draft,
      c: undefined,
    })),
    ...ownCases.map((c) => ({
      key: c.id,
      date: c.subjectAppeal?.submittedAt || c.registered,
      status: subjectCaseStatus(c),
      search: `${c.id} ${c.appealNumber} ${c.document.number} ${c.document.name} ${c.appealType || TYPES[c.type]}`,
      c,
      draft: undefined,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const matches = (text: string, rowDate: string, rowStatus: string) =>
    text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
    (status === "all" || rowStatus === status) &&
    (!from || rowDate.slice(0, 10) >= from) &&
    (!to || rowDate.slice(0, 10) <= to);
  const typeFor = (c?: (typeof cases)[number]) =>
    c ? c.appealType || TYPES[c.type] : "Возражение на аудиторский отчет";
  const visibleAppeals = appeals.filter(
    (row) =>
      matches(row.search, row.date, row.status) &&
      (appealType === "all" || typeFor(row.c) === appealType),
  );
  const visibleRequests = requests
    .filter(
      ({ c, request }) =>
        (appealType === "all" || typeFor(c) === appealType) &&
        matches(
          `${requestNumber(c, request)} ${c.id} ${c.appealType || TYPES[c.type]} ${request.recipient}`,
          request.sent || request.date,
          authorityRequestStatusLabel(request),
        ),
    )
    .sort(
      (a, b) =>
        (b.request.sent || b.request.date).localeCompare(
          a.request.sent || a.request.date,
        ) || b.c.requests.indexOf(b.request) - a.c.requests.indexOf(a.request),
    );
  const count =
    tab === "appeals" ? visibleAppeals.length : visibleRequests.length;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const activePage = Math.min(page, pageCount);
  const offset = (activePage - 1) * pageSize;
  const statuses = [
    ...new Set(
      tab === "appeals"
        ? appeals.map((row) => row.status)
        : requests.map(({ request }) => authorityRequestStatusLabel(request)),
    ),
  ];
  const switchTab = (value: "appeals" | "requests") => {
    setLocalTab(value);
    props.onSubjectRegistryTabChange?.(value);
    setQuery("");
    setStatus("all");
    setAppealType("all");
    setFrom("");
    setTo("");
    setPage(1);
  };
  const exportRows = () => {
    if (tab === "appeals")
      return onExport(visibleAppeals.flatMap((row) => (row.c ? [row.c] : [])));
    const rows = [
      [
        "Номер запроса",
        "Обращение",
        "Дата поступления",
        "Срок ответа",
        "Статус",
      ],
      ...visibleRequests.map(({ c, request }) => [
        requestNumber(c, request),
        c.id,
        formatDate(request.sent || request.date),
        formatDate(request.deadline),
        authorityRequestStatusLabel(request),
      ]),
    ];
    downloadFile(
      "saq-requests.csv",
      "\ufeff" +
        rows
          .map((row) =>
            row
              .map((value) => '"' + value.replaceAll('"', '""') + '"')
              .join(";"),
          )
          .join("\n"),
      "text/csv;charset=utf-8",
    );
  };
  return (
    <>
      <PageHeading
        title="Реестр обращений"
        subtitle="Поданные обращения и запросы в кабинет объекта аудита"
        action={
          <>
            <Button onClick={exportRows}>Экспорт CSV</Button>
            {tab === "appeals" &&
              role === "subject2" &&
              onCreateSubjectAppeal && (
                <Button primary onClick={onCreateSubjectAppeal}>
                  Подать обращение
                </Button>
              )}
          </>
        }
      />
      <section className="card subject-registry">
        <div
          className="tabs registry-tabs"
          role="tablist"
          aria-label="Реестр объекта аудита"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "appeals"}
            className={tab === "appeals" ? "active" : ""}
            onClick={() => switchTab("appeals")}
          >
            Мои обращения <span className="count">{ownCases.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "requests"}
            className={tab === "requests" ? "active" : ""}
            onClick={() => switchTab("requests")}
          >
            Запросы{" "}
            {pendingCount > 0 && (
              <span className="count" aria-label="Требуют ответа">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
        <div className="registry-filters subject-registry-filters">
          <label className="field">
            <span>Поиск</span>
            <input
              value={query}
              placeholder={
                tab === "appeals"
                  ? "Номер обращения или документа"
                  : "Номер запроса или обращения"
              }
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="field">
            <span>Статус</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Все статусы</option>
              {statuses.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Вид обращения</span>
            <select
              value={appealType}
              onChange={(e) => {
                setAppealType(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Все виды</option>
              {[
                ...new Set(
                  tab === "appeals"
                    ? appeals.map((row) => typeFor(row.c))
                    : requests.map((row) => typeFor(row.c)),
                ),
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Дата с</span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="field">
            <span>Дата по</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        <div className="subject-registry-summary muted">
          Найдено: {count}
          {tab === "requests" && <> · Требуют ответа: {pendingCount}</>}
        </div>
        <div className="table-scroll">
          {tab === "appeals" ? (
            <table className="registry-table">
              <thead>
                <tr>
                  <th>№ обращения</th>
                  <th>Дата подачи</th>
                  <th>Вид обращения</th>
                  <th>Оспариваемый документ</th>
                  <th>Статус</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {visibleAppeals.slice(offset, offset + pageSize).map((row) => (
                  <tr key={row.key}>
                    <td>
                      {row.c ? (
                        <button
                          className="text-button"
                          onClick={() => onOpen(row.c!)}
                        >
                          {row.c.id}
                        </button>
                      ) : (
                        "Черновик"
                      )}
                    </td>
                    <td>{formatDate(row.date)}</td>
                    <td>
                      {row.c?.appealType ||
                        (row.c
                          ? TYPES[row.c.type]
                          : "Возражение на аудиторский отчет")}
                    </td>
                    <td>
                      {row.c?.document.number ? (
                        <>
                          {row.c.document.name} № {row.c.document.number}
                          <span className="subline">
                            от {formatDate(row.c.document.date)}
                          </span>
                        </>
                      ) : row.c ? (
                        "—"
                      ) : (
                        "Не направлено"
                      )}
                    </td>
                    <td>
                      <span className="badge blue">{row.status}</span>
                    </td>
                    <td>
                      {row.c ? (
                        <Button onClick={() => onOpen(row.c!)}>Открыть</Button>
                      ) : (
                        <Button
                          onClick={() =>
                            onContinueSubjectAppeal?.(row.draft!.id)
                          }
                        >
                          Продолжить заполнение
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!visibleAppeals.length && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      {query ||
                      status !== "all" ||
                      appealType !== "all" ||
                      from ||
                      to
                        ? "Обращения по выбранным условиям не найдены"
                        : "Поданных обращений пока нет"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="registry-table">
              <thead>
                <tr>
                  <th>№ запроса</th>
                  <th>Обращение</th>
                  <th>Дата поступления</th>
                  <th>Срок ответа</th>
                  <th>Статус</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {visibleRequests
                  .slice(offset, offset + pageSize)
                  .map(({ c, request }) => (
                    <tr key={c.id + request.id}>
                      <td>{requestNumber(c, request)}</td>
                      <td>
                        {c.id}
                        <span className="subline">
                          {c.appealType || TYPES[c.type]}
                        </span>
                      </td>
                      <td>{formatDate(request.sent || request.date)}</td>
                      <td>{formatDate(request.deadline)}</td>
                      <td>
                        <span
                          className={`badge ${request.responded || request.responseSigned ? "green" : "blue"}`}
                        >
                          {authorityRequestStatusLabel(request)}
                        </span>
                      </td>
                      <td>
                        <Button
                          onClick={() =>
                            onOpenSubjectRequest
                              ? onOpenSubjectRequest(c, request.id)
                              : onOpen(c)
                          }
                        >
                          {request.responded || request.responseSigned
                            ? "Открыть"
                            : "Открыть / Ответить"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                {!visibleRequests.length && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      Запросы не найдены
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        <div className="subject-registry-pagination">
          <label>
            Строк на странице{" "}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 50].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <span className="muted">
            Страница {activePage} из {pageCount}
          </span>
          <Button
            disabled={activePage === 1}
            onClick={() => setPage(activePage - 1)}
          >
            Назад
          </Button>
          <Button
            disabled={activePage === pageCount}
            onClick={() => setPage(activePage + 1)}
          >
            Далее
          </Button>
        </div>
      </section>
    </>
  );
}
