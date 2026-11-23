import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import SubjectAppealStart from "../components/SubjectAppealStart";
import {
  availableSubjectAuditReports,
  createSubjectAppealDraft,
  subjectAuditReports,
  subjectAppealFilingWindow,
  submitSubjectAppeal,
} from "../services/subjectAppeals";
import type { DemoState, Role } from "../../../types";

function render(state: DemoState, draftId?: string, role: Role = "subject2") {
  return renderToStaticMarkup(
    createElement(SubjectAppealStart, {
      state,
      role,
      draftId,
      onClose() {},
      onSave() {},
      onSubmit() {},
    }),
  );
}

test("новая подача начинается с выбора вида без открытия формы и выбора документа", () => {
  const state = initialState();
  const before = structuredClone(state);
  const html = render(state);
  assert.match(html, /aria-label="Вид обращения"/);
  assert.match(html, /Возражение на аудиторский отчёт/);
  assert.match(
    html,
    /Жалоба на решение КВГА\/ДВГА/,
  );
  assert.doesNotMatch(
    html,
    /aria-label="Аудиторский отчёт"|aria-label="Подвид обращения"|subject-appeal-paper|<textarea|Подписать и направить/,
  );
  assert.deepEqual(state, before);
});

test("доступность отчёта учитывает дату представления, последний день включительно и принадлежность кабинету", () => {
  const state = initialState();
  const report = subjectAuditReports(state.cases, "subject2")[0];
  const window = subjectAppealFilingWindow(report, state.date);
  assert.equal(
    availableSubjectAuditReports(state.cases, "subject2", "2026-09-07").length,
    0,
  );
  assert.equal(
    availableSubjectAuditReports(state.cases, "subject2", window.presentedAt)
      .length,
    1,
  );
  assert.equal(
    availableSubjectAuditReports(state.cases, "subject2", window.deadline)
      .length,
    1,
  );
  assert.equal(
    availableSubjectAuditReports(state.cases, "subject2", "2026-12-31").length,
    0,
  );
  for (const role of ["subject", "work", "dvga", "kvga"] as const)
    assert.equal(
      availableSubjectAuditReports(state.cases, role, state.date).length,
      0,
    );
  const foreign = structuredClone(
    state.cases.find((c) => c.id === report.sourceCaseId)!,
  );
  foreign.bin = "999999999999";
  assert.equal(
    availableSubjectAuditReports([foreign], "subject2", state.date).length,
    0,
  );
  foreign.bin = report.bin;
  foreign.document.signedReportPresentedAt = "";
  assert.equal(
    availableSubjectAuditReports([foreign], "subject2", state.date).length,
    0,
  );
});

test("продолжение черновика открывает прежнюю форму только для выбранного доступного отчёта", () => {
  const state = initialState();
  const report = subjectAuditReports(state.cases, "subject2")[0];
  const unrelated = structuredClone(
    state.cases.find((c) => c.id === report.sourceCaseId)!,
  );
  unrelated.id = "unselected-report";
  unrelated.document.number = "OTHER-REPORT";
  state.cases.push(unrelated);
  const draft = createSubjectAppealDraft(report, "gate-draft");
  state.subjectAppealDrafts = [draft];
  const html = render(state, draft.id);
  assert.match(html, /subject-appeal-paper/);
  assert.match(html, /Подписать и направить/);
  assert.doesNotMatch(html, /OTHER-REPORT|aria-label="Вид обращения"/);
  const blocked = render({ ...state, date: "2026-12-31" }, draft.id);
  assert.match(
    blocked,
    /Нет доступных для подачи возражения аудиторских отчётов/,
  );
  assert.doesNotMatch(
    blocked,
    /subject-appeal-paper|<textarea|Подписать и направить/,
  );
  const missing = render({ ...state, cases: [] }, draft.id);
  assert.doesNotMatch(missing, /subject-appeal-paper|Подписать и направить/);
  assert.doesNotMatch(
    render(state, draft.id, "subject"),
    /subject-appeal-paper|Подписать и направить/,
  );
});

test("сохранённый черновик сохраняет прежние проверки отправки после истечения срока", () => {
  const state = initialState();
  const report = subjectAuditReports(state.cases, "subject2")[0];
  const draft = createSubjectAppealDraft(report, "expired-gate-draft");
  draft.selectedPointIds = [report.points[0].id];
  draft.argumentsByPoint = { [report.points[0].id]: "Довод" };
  draft.signerName = "Тест";
  assert.throws(
    () =>
      submitSubjectAppeal({ ...state, date: "2026-12-31" }, draft, "subject2"),
    /Срок подачи возражения истёк/,
  );
});
