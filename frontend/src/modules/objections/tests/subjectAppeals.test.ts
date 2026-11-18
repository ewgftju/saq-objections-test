import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createDemoRepository,
  initialState,
} from "../../../api/objectionsRepository";
import type { SubjectAppealDraft } from "../../../types";
import CasesList from "../pages/CasesList";
import { caseVisibleToRole } from "../services/caseVisibility";
import {
  createSubjectAppealDraft,
  MAX_APPEAL_FILE_SIZE,
  reportFingerprint,
  saveSubjectAppealDraft,
  subjectAuditReports,
  submitSubjectAppeal,
} from "../services/subjectAppeals";
import {
  SubjectAppealDocument,
  subjectAppealHtml,
} from "../components/SubjectAppealDocument";
import { DocumentContent } from "../components/DocumentModal";

function fixture() {
  const state = initialState();
  const source = state.cases.find(
    (c) => c.type === "audit" && c.bin === "001002003004",
  )!;
  source.issues.push({
    id: "another-report-point",
    number: "12",
    title: "Неоспариваемое нарушение",
    finding: "Вывод из отчёта",
    argument: "Старый довод из другого обращения",
    amount: 100,
    disputed: false,
  });
  source.issues[0].translations = { kk: { title: "Есептің төртінші тармағы" } };
  source.orgTranslations = { ru: source.org, kk: "«Аудит» ЖШС" };
  const report = subjectAuditReports(state.cases, "subject2")[0];
  const draft: SubjectAppealDraft = {
    ...createSubjectAppealDraft(report, "submitted-draft"),
    circumstances: "Договор был представлен до завершения аудита.",
    signerName: "Тестов Тест Тестович",
    selectedPointIds: [report.points[0].id],
    argumentsByPoint: {
      [report.points[0].id]: "Не согласен с выводом по пункту 4.",
    },
    attachments: [
      {
        id: "proof-1",
        name: "Договор.docx",
        size: 5,
        dataUrl: "data:application/octet-stream;base64,aGVsbG8=",
        pointId: report.points[0].id,
      },
    ],
  };
  return { state, source, report, draft };
}

test("кнопка подачи есть только у объекта №2, существующие кабинеты не меняются", () => {
  for (const role of [
    "subject2",
    "subject",
    "work",
    "dvga",
    "commission",
  ] as const) {
    const html = renderToStaticMarkup(
      createElement(CasesList, {
        cases: [],
        date: "2026-09-08",
        role,
        onOpen() {},
        onCreate() {},
        onExport() {},
        onCreateSubjectAppeal() {},
      }),
    );
    assert.equal(html.includes(">Подать обращение<"), role === "subject2");
  }
});

test("источник содержит только отчёты своего объекта, включая неоспариваемые пункты", () => {
  const { state, source, report } = fixture();
  assert.equal(subjectAuditReports(state.cases, "work").length, 0);
  assert.equal(report.number, source.document.number);
  assert.equal(report.points.at(-1)?.number, "12");
  assert.ok(
    report.points.every(
      (point) => !("argument" in point) && !("analysis" in point),
    ),
  );
  state.cases.push({
    ...structuredClone(source),
    id: "foreign",
    bin: "999999999999",
    document: { ...source.document, number: "FOREIGN" },
  });
  assert.ok(
    subjectAuditReports(state.cases, "subject2").every(
      (r) => r.bin === "001002003004",
    ),
  );
});

test("сохранение и повторная загрузка черновика не регистрируют обращение", () => {
  const { state, report } = fixture();
  const partial = createSubjectAppealDraft(report, "draft-only");
  partial.circumstances = "Незаконченный текст";
  const saved = saveSubjectAppealDraft(state, partial, "subject2");
  assert.equal(saved.cases.length, state.cases.length);
  const values = new Map<string, string>();
  const repo = createDemoRepository({
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  });
  repo.save(saved);
  assert.equal(
    repo.load().subjectAppealDrafts?.[0].circumstances,
    "Незаконченный текст",
  );
  assert.equal(state.subjectAppealDrafts, undefined);
});

test("подача переносит выбранные пункты и файлы, сохраняет снимок, направляет директору", () => {
  const { state, source, report, draft } = fixture();
  const result = submitSubjectAppeal(state, draft, "subject2");
  const c = result.state.cases.find((item) => item.id === result.caseId)!;
  assert.equal(c.channel, "SAQ");
  assert.equal(c.status, "received");
  assert.equal(c.assignee, "Не назначен");
  assert.equal(c.unread, true);
  assert.equal(caseVisibleToRole(c, "work"), false);
  assert.equal(caseVisibleToRole(c, "director"), true);
  assert.equal(c.document.number, source.document.number);
  assert.deepEqual(
    c.issues.map((point) => point.number),
    ["4"],
  );
  assert.equal(
    c.issues[0].authorityFinding,
    report.points[0].finding || report.points[0].title,
  );
  assert.equal(c.issues[0].evidence, "Договор.docx");
  assert.equal(c.subjectAppeal?.draft.circumstances, draft.circumstances);
  assert.notEqual(c.request, draft.circumstances);
  assert.equal(c.documents.filter((document) => document.dataUrl).length, 1);
  assert.ok(
    result.state.notifications.some(
      (n) => n.recipientRole === "director" && n.caseId === c.id,
    ),
  );
  source.issues[0].title = "Исправленный исходник";
  draft.circumstances = "Изменённый черновик";
  assert.notEqual(
    c.subjectAppeal?.report.points[0].title,
    source.issues[0].title,
  );
  assert.notEqual(c.subjectAppeal?.draft.circumstances, draft.circumstances);
});

test("повторная отправка одной подписанной версии возвращает прежний номер", () => {
  const { state, draft } = fixture();
  const once = submitSubjectAppeal(state, draft, "subject2");
  const twice = submitSubjectAppeal(once.state, draft, "subject2");
  assert.equal(twice.caseId, once.caseId);
  assert.equal(twice.state.cases.length, state.cases.length + 1);
  assert.equal(
    subjectAuditReports(twice.state.cases, "subject2").length,
    subjectAuditReports(state.cases, "subject2").length,
  );
});

test("чужая роль, чужой отчёт, неизвестный пункт и изменённый источник не принимаются", () => {
  const { state, draft } = fixture();
  assert.throws(
    () => submitSubjectAppeal(state, draft, "subject"),
    /кабинете объекта/,
  );
  assert.throws(
    () =>
      submitSubjectAppeal(
        state,
        { ...draft, sourceCaseId: "чужой" },
        "subject2",
      ),
    /Отчёт недоступен/,
  );
  assert.throws(
    () =>
      submitSubjectAppeal(
        state,
        { ...draft, selectedPointIds: ["несуществующий"] },
        "subject2",
      ),
    /которого нет/,
  );
  state.cases.find((c) => c.id === draft.sourceCaseId)!.document.number =
    "Изменённый отчёт";
  assert.throws(
    () => submitSubjectAppeal(state, draft, "subject2"),
    /изменились/,
  );
});

test("проверяются обстоятельства, доводы и размер доказательства", () => {
  const { state, draft } = fixture();
  assert.throws(
    () =>
      submitSubjectAppeal(state, { ...draft, circumstances: " " }, "subject2"),
    /обстоятельства/,
  );
  assert.throws(
    () =>
      submitSubjectAppeal(
        state,
        { ...draft, argumentsByPoint: {} },
        "subject2",
      ),
    /пункту № 4/,
  );
  assert.throws(
    () =>
      submitSubjectAppeal(
        state,
        { ...draft, selectedPointIds: [] },
        "subject2",
      ),
    /хотя бы один/,
  );
  assert.throws(
    () =>
      submitSubjectAppeal(
        state,
        {
          ...draft,
          attachments: [
            { ...draft.attachments[0], size: MAX_APPEAL_FILE_SIZE + 1 },
          ],
        },
        "subject2",
      ),
    /до 2 МБ/,
  );
});

test("печатная форма выводит пять разделов, приложение по пунктам и названия файлов на нужном языке", () => {
  const { report, draft } = fixture();
  draft.language = "kk";
  draft.circumstances = '<script>alert("x")</script>';
  const html = subjectAppealHtml(report, draft, "2026-09-08");
  assert.match(html, /Қарсылық/);
  assert.match(html, /Мемлекеттік аудит жүргізген/);
  assert.match(html, /Атырау облысы/);
  assert.match(html, /Есептің төртінші тармағы/);
  assert.match(html, /Договор.docx/);
  assert.match(html, /Қоса берілетін құжаттардың тізбесі/);
  assert.match(html, /&lt;script&gt;/);
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("Неоспариваемое нарушение"));
  assert.ok(!html.includes("Старый довод"));
  assert.equal(reportFingerprint(report), draft.sourceFingerprint);
});

test("директор открывает ту же поданную форму, без повторного создания документа", () => {
  const { state, draft } = fixture();
  const submitted = submitSubjectAppeal(state, draft, "subject2");
  const c = submitted.state.cases[0];
  const html = renderToStaticMarkup(
    createElement(DocumentContent, { c, kind: "original" }),
  );
  const expected = renderToStaticMarkup(
    createElement(SubjectAppealDocument, {
      report: c.subjectAppeal!.report,
      draft: c.subjectAppeal!.draft,
      date: state.date,
      submitted: true,
    }),
  );
  assert.equal(html, expected);
});
