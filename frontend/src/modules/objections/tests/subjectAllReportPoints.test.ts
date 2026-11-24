import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDemoRepository, initialState } from "../../../api/objectionsRepository";
import SubjectAppealForm from "../components/SubjectAppealForm";
import { subjectAppealHtml } from "../components/SubjectAppealDocument";
import { DocumentContent } from "../components/DocumentModal";
import { actionForm } from "../formDefinitions";
import { addSubjectAppealPoint, removeSubjectAppealPoint } from "../services/subjectAppealPoints";
import { createSubjectAppealDraft, refreshSubjectAppealDraftSource, reportFingerprint, saveSubjectAppealDraft, subjectAuditReports, submitSubjectAppeal } from "../services/subjectAppeals";
import { evidenceDocumentsForPoint } from "../services/pointEvidence";

function fixture() {
  const state = initialState();
  const report = subjectAuditReports(state.cases, "subject2").find(report => report.number === "1-АО")!;
  const draft = createSubjectAppealDraft(report, "all-report-points");
  return { state, report, draft };
}

test("доступны все 15 основных пунктов, включая пустые пункты без нарушений; вопросы раздела 11 не совпадают с пунктами 1 и 2", () => {
  const { report, draft } = fixture();
  const sections = report.points.filter(point => point.auditReportPoint);
  assert.deepEqual(sections.map(point => point.number), Array.from({ length: 15 }, (_, i) => String(i + 1)));
  assert.ok(sections.some(point => point.auditReportPoint!.text === "—"));
  assert.equal(report.points.find(point => point.id === "vga-test-question-1")!.number, "11.1");
  assert.equal(sections[0].number, "1");
  assert.equal(new Set(report.points.map(point => point.id)).size, report.points.length);
  for (const point of sections) assert.deepEqual(addSubjectAppealPoint(draft, report, point.id).selectedPointIds, [point.id]);
});

test("добавление через плюс не допускает повторных и чужих пунктов, удаление сохраняет обстоятельства и файлы других пунктов", () => {
  const { report, draft } = fixture();
  const first = report.points.find(point => point.number === "5")!;
  const second = report.points.find(point => point.number === "6")!;
  const added = addSubjectAppealPoint(addSubjectAppealPoint(draft, report, first.id), report, second.id);
  assert.throws(() => addSubjectAppealPoint(added, report, first.id), /уже добавлен/);
  assert.throws(() => addSubjectAppealPoint(added, report, "foreign"), /Выберите пункт/);
  added.argumentsByPoint = { [first.id]: "Обстоятельства 5", [second.id]: "Обстоятельства 6" };
  added.attachments = [first, second].map(point => ({ id: "file-" + point.id, pointId: point.id, name: "Одинаковое имя.pdf", size: 1, dataUrl: "data:application/pdf;base64," + point.number }));
  const removed = removeSubjectAppealPoint(added, first.id);
  assert.deepEqual(removed.selectedPointIds, [second.id]);
  assert.deepEqual(removed.argumentsByPoint, { [second.id]: "Обстоятельства 6" });
  assert.deepEqual(removed.attachments, [added.attachments[1]]);
  assert.equal(added.attachments.length, 2);
});

test("редактор показывает плюс и только добавленные пункты без списка чекбоксов", () => {
  const { state, report, draft } = fixture();
  const selected = report.points.filter(point => ["5", "6"].includes(point.number));
  draft.selectedPointIds = selected.map(point => point.id);
  state.subjectAppealDrafts = [draft];
  const html = renderToStaticMarkup(createElement(SubjectAppealForm, { state, role: "subject2", draftId: draft.id, onClose() {}, onSave() {}, onSubmit() {} }));
  assert.ok(html.includes("+ Добавить пункт"));
  assert.ok(html.includes("Удалить пункт"));
  assert.doesNotMatch(html, /type="checkbox"|Вопрос программы аудита/);
  for (const point of selected) assert.ok(html.includes(`Обстоятельства по пункту ${point.number}`));
  assert.ok(!html.includes('aria-label="Обстоятельства по пункту 7"'));
});

test("полный состав ВГА имеет приоритет над перечнем нарушений, передаётся целиком и не изменяет источник", () => {
  const { state } = fixture();
  const source = state.cases.find(item => item.bin === "001002003004" && item.document.number === "1-АО")!;
  source.auditReportPoints = [{ id: "no-violation", number: "7", title: "Период аудита", titleRu: "Период аудита", finding: "", amount: 0, auditReportPoint: { number: "7", name: "Период аудита", text: "Нарушения не выявлены", language: "ru" } }];
  const report = subjectAuditReports(state.cases, "subject2").find(item => item.sourceCaseId === source.id)!;
  assert.deepEqual(report.points, source.auditReportPoints);
  report.points[0].auditReportPoint!.text = "Изменение копии";
  assert.equal(source.auditReportPoints[0].auditReportPoint!.text, "Нарушения не выявлены");
});

test("черновик прежних двух вопросов получает полный состав отчёта без потери доводов и файлов; изменения исходного текста не игнорируются", () => {
  const { state, report, draft } = fixture();
  const oldReport = structuredClone(report);
  oldReport.points = oldReport.points.filter(point => point.auditProgramResult).map(point => ({ ...point, number: point.auditProgramResult!.number }));
  const question = oldReport.points[0];
  const oldDraft = { ...draft, sourceFingerprint: reportFingerprint(oldReport), selectedPointIds: [question.id], argumentsByPoint: { [question.id]: "Сохранённые обстоятельства" }, attachments: [{ id: "old-file", pointId: question.id, name: "Файл.pdf", size: 1, dataUrl: "data:application/pdf;base64,YQ==" }] };
  const refreshed = refreshSubjectAppealDraftSource(oldDraft, report);
  assert.equal(refreshed.sourceFingerprint, reportFingerprint(report));
  assert.deepEqual(refreshed.selectedPointIds, oldDraft.selectedPointIds);
  assert.deepEqual(refreshed.argumentsByPoint, oldDraft.argumentsByPoint);
  assert.deepEqual(refreshed.attachments, oldDraft.attachments);
  assert.doesNotThrow(() => saveSubjectAppealDraft(state, refreshed, "subject2"));
  oldReport.points[0].auditProgramResult!.answer = "Изменённый ответ";
  const stale = refreshSubjectAppealDraftSource({ ...oldDraft, sourceFingerprint: reportFingerprint(oldReport) }, report);
  assert.notEqual(stale.sourceFingerprint, reportFingerprint(report));
});

test("обычные пункты отчёта проходят подачу на обоих языках с отдельными доказательствами, снимком и редактируемым ответом органа", () => {
  for (const language of ["ru", "kk"] as const) {
    const { state, report: sourceReport } = fixture();
    const source = state.cases.find(item => item.id === sourceReport.sourceCaseId)!;
    source.auditReportPoints = structuredClone(sourceReport.points);
    const selected = source.auditReportPoints.filter(point => ["5", "6"].includes(point.number));
    for (const point of selected) point.auditReportPoint!.translations = { kk: { name: `Тармақ ${point.number}`, text: `Мазмұны ${point.number}` } };
    const report = subjectAuditReports(state.cases, "subject2").find(item => item.sourceCaseId === source.id)!;
    const draft = { ...createSubjectAppealDraft(report, "full-" + language), language, selectedPointIds: selected.map(point => point.id), argumentsByPoint: Object.fromEntries(selected.map(point => [point.id, `Обстоятельства ${point.number}`])), attachments: selected.map(point => ({ id: `proof-${point.number}`, pointId: point.id, name: "Документ.pdf", size: 1, dataUrl: "data:application/pdf;base64," + point.number })) };
    const savedDraft = saveSubjectAppealDraft(state, draft, "subject2");
    const store = new Map<string, string>();
    const repo = createDemoRepository({ getItem: key => store.get(key) || null, setItem: (key, value) => { store.set(key, value); } });
    repo.save(savedDraft);
    const restored = repo.load();
    const result = submitSubjectAppeal(restored, restored.subjectAppealDrafts![0], "subject2");
    const c = result.state.cases.find(item => item.id === result.caseId)!;
    assert.deepEqual(c.issues.map(point => point.number), ["5", "6"]);
    const print = subjectAppealHtml(c.subjectAppeal!.report, c.subjectAppeal!.draft, state.date, true);
    for (const point of c.issues) {
      assert.equal(point.title, "");
      assert.equal(point.auditProgramResult, undefined);
      assert.deepEqual(point.auditReportPoint, selected.find(item => item.id === point.id)!.auditReportPoint);
      assert.ok(print.includes(point.argument));
      assert.deepEqual(evidenceDocumentsForPoint(point, c.documents).map(file => file.dataUrl), [draft.attachments.find(file => file.pointId === point.id)!.dataUrl]);
      if (language === "kk") assert.ok(print.includes(`Тармақ ${point.number}`));
    }
    const fields = actionForm("fill-request-response", c, state.date, {}, "dvga").fields;
    const suffix = language === "kk" ? "Kk" : "";
    for (const point of c.issues) {
      const field = fields.find(field => field.name === `authorityFinding${suffix}_${point.id}`)!;
      assert.equal(field.value, language === "kk" ? `Мазмұны ${point.number}` : point.auditReportPoint!.text);
      assert.notEqual(field.readOnly, true);
    }
    const request = renderToStaticMarkup(createElement(DocumentContent, { c, kind: "request-appendix" }));
    assert.ok(request.includes("Оспариваемый пункт аудиторского отчёта"));
    source.auditReportPoints[0].title = "Позднее изменение источника";
    assert.notEqual(c.subjectAppeal!.report.points[0].title, source.auditReportPoints[0].title);
  }
});
