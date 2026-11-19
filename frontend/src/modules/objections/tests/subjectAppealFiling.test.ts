import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import SubjectAppealForm from "../components/SubjectAppealForm";
import CasesList from "../pages/CasesList";
import { filingDeadline } from "../services/deadlines";
import {
  createSubjectAppealDraft,
  saveSubjectAppealDraft,
  subjectAppealFilingWindow,
  subjectAuditReports,
  submitSubjectAppeal,
} from "../services/subjectAppeals";

function fixture() {
  const state = initialState();
  const source = state.cases.find(c => c.type === "audit" && c.bin === "001002003004")!;
  state.cases = [source];
  source.document.date = "2026-09-01";
  source.document.received = "2026-09-08";
  source.document.signedReportPresentedAt = "2026-10-16";
  state.date = "2026-10-16";
  const report = subjectAuditReports(state.cases, "subject2")[0];
  const draft = {
    ...createSubjectAppealDraft(report, "filing-deadline-draft"),
    signerName: "Тестовый заявитель",
    selectedPointIds: [report.points[0].id],
    argumentsByPoint: { [report.points[0].id]: "Довод заявителя" },
    attachments: [{ id: "proof", name: "Доказательство.pdf", size: 1, dataUrl: "data:application/pdf;base64,YQ==", pointId: report.points[0].id }],
  };
  state.subjectAppealDrafts = [draft];
  return { state, source, report, draft };
}

test("10 рабочих дней считаются от представления подписанного отчёта с пропуском выходных и праздника", () => {
  const { source, report } = fixture();
  const window = subjectAppealFilingWindow(report, "2026-10-16");
  assert.equal(window.presentedAt, "2026-10-16");
  assert.equal(window.deadline, "2026-11-02");
  assert.equal(window.allowed, true);
  assert.equal(filingDeadline(source), window.deadline);
  assert.equal(subjectAppealFilingWindow({ received: "2026-09-08" }, "2026-09-08").deadline, "2026-09-22");
});

test("в последний день отправка разрешена; на следующий день отклоняется без создания обращения", () => {
  const { state, report, draft } = fixture();
  state.date = "2026-11-02";
  const submitted = submitSubjectAppeal(state, draft, "subject2");
  assert.equal(submitted.state.cases[0].subjectAppeal?.report.signedReportPresentedAt, report.signedReportPresentedAt);
  assert.equal(submitted.state.cases[0].document.signedReportPresentedAt, report.signedReportPresentedAt);
  state.date = "2026-11-03";
  const before = structuredClone(state);
  assert.throws(() => submitSubjectAppeal(state, draft, "subject2"), /Срок подачи возражения истёк.*02\.11\.2026/);
  assert.deepEqual(state, before);
  assert.equal(subjectAppealFilingWindow(report, state.date).status, "expired");
  assert.equal(submitSubjectAppeal({ ...submitted.state, date: state.date }, draft, "subject2").caseId, submitted.caseId);
});

test("до представления подписанного отчёта подача заблокирована", () => {
  const { state, draft, report } = fixture();
  state.date = "2026-10-15";
  assert.equal(subjectAppealFilingWindow(report, state.date).status, "not-started");
  assert.throws(() => submitSubjectAppeal(state, draft, "subject2"), /с даты представления.*16\.10\.2026/);
});

test("отсутствующая или некорректная дата представления не подменяется датой самого отчёта", () => {
  for (const value of ["", "неизвестно", "2026-02-30"]) {
    const { state, source } = fixture();
    source.document.signedReportPresentedAt = value;
    const report = subjectAuditReports(state.cases, "subject2")[0];
    const draft = createSubjectAppealDraft(report, "missing-date");
    assert.equal(subjectAppealFilingWindow(report, state.date).status, "missing-date");
    assert.throws(() => submitSubjectAppeal(state, draft, "subject2"), /дата представления/);
  }
});

test("сохранение черновика и его повторное открытие не продлевают срок подачи", () => {
  const { state, draft, report } = fixture();
  state.date = "2026-11-03";
  const saved = saveSubjectAppealDraft(state, draft, "subject2");
  assert.equal(saved.subjectAppealDrafts?.[0].savedAt, state.date);
  assert.equal(subjectAppealFilingWindow(report, state.date).allowed, false);
  assert.throws(() => submitSubjectAppeal(saved, saved.subjectAppealDrafts![0], "subject2"), /Срок подачи/);
  const render = () => renderToStaticMarkup(createElement(SubjectAppealForm, {
    state: saved, role: "subject2", draftId: draft.id, onClose() {}, onSave() {}, onSubmit() {},
  }));
  const expired = render();
  assert.match(expired, /Срок подачи возражения истёк/);
  assert.match(expired, /02\.11\.2026/);
  assert.match(expired, /<button[^>]*type="submit"[^>]*disabled=""/);
  saved.date = "2026-11-02";
  assert.doesNotMatch(render(), /<button[^>]*type="submit"[^>]*disabled=""/);
});

test("кнопка в реестре открывает выбор вида; истёкший срок проверяется до открытия формы", () => {
  const { state } = fixture();
  const render = () => renderToStaticMarkup(createElement(CasesList, {
    cases: state.cases, date: state.date, role: "subject2", onOpen() {}, onCreate() {}, onExport() {}, onCreateSubjectAppeal() {},
  }));
  assert.doesNotMatch(render(), /<button[^>]*disabled=""[^>]*>Подать обращение<\/button>/);
  state.date = "2026-11-03";
  assert.doesNotMatch(render(), /<button[^>]*disabled=""[^>]*>Подать обращение<\/button>/);
  assert.match(render(), />Подать обращение<\/button>/);
});
