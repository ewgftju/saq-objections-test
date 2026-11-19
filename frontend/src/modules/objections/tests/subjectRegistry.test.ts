import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import type { CaseRequest, CaseTab, ObjectionCase } from "../../../types";
import CasesList from "../pages/CasesList";
import CaseWorkspace from "../pages/CaseWorkspace";
import { caseVisibleToRole } from "../services/caseVisibility";
import {
  isApplicantCase,
  isSubjectRequest,
  subjectCanOpenCase,
} from "../services/subjectRegistry";
import { pathForRoute, routeFromPath } from "../routing";
import { applyAction } from "../services/workflow";
import {
  createSubjectAppealDraft,
  subjectAuditReports,
  submitSubjectAppeal,
} from "../services/subjectAppeals";

function fixture() {
  const state = initialState();
  const c = state.cases.find((c) => c.bin === "001002003004")!;
  c.id = "В-2026-777";
  c.requests = [
    {
      id: "first",
      requestNumber: "FIRST-REQUEST",
      template: "other",
      saqRecipient: "subject",
      recipient: "Объект №2",
      date: state.date,
      sent: state.date,
      deadline: "2026-09-10",
      text: "Первый запрос",
    },
    {
      id: "second",
      requestNumber: "SECOND-REQUEST",
      template: "other",
      saqRecipient: "subject2",
      recipient: "Объект №2",
      date: state.date,
      sent: state.date,
      deadline: "2026-09-11",
      text: "Второй запрос",
      responded: state.date,
      responseSigned: state.date,
    },
    {
      id: "cancelled",
      requestNumber: "CANCELLED-REQUEST",
      template: "other",
      saqRecipient: "subject",
      recipient: "Объект №2",
      date: state.date,
      sent: state.date,
      deadline: state.date,
      text: "Отменённый",
      cancelled: state.date,
    },
    {
      id: "draft",
      requestNumber: "UNSENT-REQUEST",
      template: "other",
      saqRecipient: "subject",
      recipient: "Объект №2",
      date: state.date,
      deadline: state.date,
      text: "Черновик запроса",
    },
    {
      id: "authority",
      requestNumber: "AUTHORITY-REQUEST",
      template: "dvga",
      recipient: "ДВГА",
      date: state.date,
      sent: state.date,
      deadline: state.date,
      text: "Внутренний запрос",
    },
  ] as CaseRequest[];
  return { state, c };
}

function registry(
  cases: ObjectionCase[],
  tab: "appeals" | "requests" = "appeals",
) {
  return renderToStaticMarkup(
    createElement(CasesList, {
      cases,
      date: "2026-09-08",
      role: "subject2",
      subjectRegistryTab: tab,
      onOpen() {},
      onCreate() {},
      onExport() {},
      onCreateSubjectAppeal() {},
    }),
  );
}

function workspace(c: ObjectionCase, tab: CaseTab, selectedRequestId?: string) {
  return renderToStaticMarkup(
    createElement(CaseWorkspace, {
      c,
      tab,
      selectedRequestId,
      role: "subject2",
      date: "2026-09-08",
      onBack() {},
      onTab() {},
      onAction() {},
      onDocument() {},
      onUpload() {},
    }),
  );
}

test("объекты получают две вкладки; свои обращения доступны до назначения исполнителя", () => {
  const { state } = fixture();
  const report = subjectAuditReports(state.cases, "subject2")[0];
  const draft = {
    ...createSubjectAppealDraft(report, "new-appeal"),
    signerName: "Заявитель",
    selectedPointIds: [report.points[0].id],
    argumentsByPoint: { [report.points[0].id]: "Мой довод" },
    attachments: [{ id: "proof", name: "Доказательство.pdf", size: 1, dataUrl: "data:application/pdf;base64,YQ==", pointId: report.points[0].id }],
  };
  const submitted = submitSubjectAppeal(state, draft, "subject2").state
    .cases[0];
  assert.equal(caseVisibleToRole(submitted, "subject2"), true);
  assert.equal(subjectCanOpenCase(submitted, "subject2"), true);
  assert.equal(caseVisibleToRole(submitted, "work"), false);
  assert.equal(caseVisibleToRole(submitted, "subject"), false);
  const html = registry([submitted]);
  assert.match(html, /Мои обращения/);
  assert.match(html, /Запросы/);
  assert.ok(html.includes(submitted.id));
  assert.ok(!html.includes("Ожидает назначения исполнителя"));
  assert.ok(!html.includes("subject-appeal-registry-row"));
  assert.match(html, /Страница 1 из 1/);
});

test("в запросах отдельные строки, включая отвеченные; отсутствуют отменённые, ненаправленные и чужие", () => {
  const { c } = fixture();
  const foreign = {
    ...structuredClone(c),
    id: "FOREIGN-CASE",
    bin: "111111111111",
  };
  foreign.requests = [{ ...c.requests[0], requestNumber: "FOREIGN-REQUEST" }];
  const html = registry([c, foreign], "requests");
  assert.match(html, /FIRST-REQUEST/);
  assert.match(html, /SECOND-REQUEST/);
  assert.match(html, /Ответ направлен/);
  assert.match(html, /Требуют ответа: 1/);
  for (const value of [
    "FOREIGN-REQUEST",
    "CANCELLED-REQUEST",
    "UNSENT-REQUEST",
    "AUTHORITY-REQUEST",
    "Подать обращение",
  ])
    assert.ok(!html.includes(value));
  assert.equal(isApplicantCase(foreign, "subject2"), false);
  assert.equal(subjectCanOpenCase(foreign, "subject2"), false);
  assert.equal(isSubjectRequest(c, c.requests[2], "subject2"), false);
});

test("большой реестр разбивается на страницы и сортируется по новизне", () => {
  const { c } = fixture();
  const rows = Array.from({ length: 25 }, (_, n) => ({
    ...structuredClone(c),
    id: "ITEM-" + String(n).padStart(2, "0"),
    registered: `2026-09-${String(n + 1).padStart(2, "0")}`,
  }));
  const html = registry(rows);
  assert.match(html, /Страница 1 из 3/);
  assert.ok(html.includes("ITEM-24"));
  assert.ok(!html.includes("ITEM-00"));
  assert.ok(html.indexOf("ITEM-24") < html.indexOf("ITEM-23"));
});

test("общая карточка заявителя имеет две вкладки и скрывает внутренние материалы", () => {
  const { c } = fixture();
  c.issues[0].argument = "ДОВОД-ЗАЯВИТЕЛЯ";
  c.issues[0].analysis = "СЛУЖЕБНЫЙ-АНАЛИЗ";
  c.documents.push({
    kind: "certificate",
    name: "ВНУТРЕННЯЯ-СПРАВКА",
    text: "СЛУЖЕБНЫЙ-ТЕКСТ",
    date: "2026-09-08",
    author: "Рабочий орган",
  });
  const overview = workspace(c, "overview");
  assert.match(overview, />Обращение<\/button>/);
  assert.match(overview, />Процесс рассмотрения<\/button>/);
  assert.match(overview, /ДОВОД-ЗАЯВИТЕЛЯ/);
  assert.match(overview, /Поданное обращение/);
  for (const tab of ["overview", "review", "documents", "history"] as const) {
    const html = workspace(c, tab);
    assert.ok(!html.includes("ВНУТРЕННЯЯ-СПРАВКА"));
    assert.ok(!html.includes("СЛУЖЕБНЫЙ-АНАЛИЗ"));
    assert.ok(!html.includes(">История<"));
  }
  assert.ok(
    !workspace(c, "review", "second").includes("Подготовить ответ на запрос"),
  );
});

test("адресный ответ изменяет выбранный запрос, включая согласование и подпись при другом ожидающем запросе", () => {
  let { state, c } = fixture();
  delete c.requests[1].responded;
  delete c.requests[1].responseSigned;
  c.status = "request_approved";
  const form = new FormData();
  form.set("requestId", "second");
  for (const action of [
    "subject-response",
    "approve-response",
    "sign-response",
  ] as const)
    state = applyAction(state, c.id, action, "subject2", form);
  const result = state.cases.find((row) => row.id === c.id)!;
  assert.equal(result.requests[0].responsePrepared, undefined);
  assert.equal(result.requests[1].responded, state.date);
  assert.equal(result.requests[1].responseSigned, state.date);
  form.set("requestId", "authority");
  assert.throws(() =>
    applyAction(state, c.id, "subject-response", "subject2", form),
  );
  form.set("requestId", "first");
  assert.throws(() =>
    applyAction(state, c.id, "subject-response", "subject", form),
  );
});

test("маршрут сохраняет вкладку запросов и выбранный запрос при перезагрузке и возврате", () => {
  const route = {
    page: "detail" as const,
    caseId: "В-2026-777",
    tab: "review" as const,
    registryTab: "requests" as const,
    requestId: "second / 2",
  };
  assert.deepEqual(routeFromPath(pathForRoute(route)), route);
  assert.deepEqual(
    routeFromPath(pathForRoute({ page: "registry", registryTab: "requests" })),
    { page: "registry", registryTab: "requests" },
  );
  assert.deepEqual(routeFromPath("/cases"), { page: "registry" });
});

test("заявитель видит проект решения только после направления в кабинет", () => {
  const { c } = fixture();
  c.decisionProjectRouting = { channel: "saq", recipients: [] };
  c.documents.push({
    kind: "decision-project",
    name: "ПРОЕКТ-ДЛЯ-ЗАЯВИТЕЛЯ",
    date: "2026-09-08",
    text: "",
    author: "",
  });
  assert.ok(!workspace(c, "review").includes("ПРОЕКТ-ДЛЯ-ЗАЯВИТЕЛЯ"));
  c.decisionProjectRouting.sentAt = "2026-09-08";
  assert.ok(workspace(c, "review").includes("ПРОЕКТ-ДЛЯ-ЗАЯВИТЕЛЯ"));
});
