import assert from "node:assert/strict";
import test from "node:test";
import { initialState } from "../../../api/objectionsRepository";
import { actionForm } from "../formDefinitions";
import { reportPointTitle, workAuditPointSource } from "../services/auditProgramResults";
import { findWorkAuditReports, subjectAppealFilingWindow, subjectAuditReports } from "../services/subjectAppeals";

test("рабочий орган находит источник по номеру после срока подачи и видит разделы и вопросы программы", () => {
  const { cases } = initialState();
  const [report] = findWorkAuditReports(cases, " № 1-ао ");
  assert.equal(subjectAppealFilingWindow(report, "2026-11-26").allowed, false);
  assert.equal(report.date, "2026-09-05");
  assert.equal(report.addressTranslations?.kk, "Астана қ., Учебная к., 1");
  assert.equal(report.points.length, 17);
  const question = report.points.find(p => p.number === "11.1")!;
  assert.equal(reportPointTitle(question, "ru"), "Представительские расходы");
  assert.equal(reportPointTitle(question, "kk"), "Өкілдік шығыстар");
  assert.ok(report.points.some(point => point.number === "7"));
  assert.deepEqual(findWorkAuditReports(cases, "несуществующий номер"), []);
});

test("одноимённые отчёты разных объектов различимы, зарегистрированное возражение не становится источником", () => {
  const { cases } = initialState();
  const [report] = findWorkAuditReports(cases, "1-АО");
  const source = cases.find(c => c.id === report.sourceCaseId)!;
  const other = {
    ...structuredClone(source), id: "second-source", bin: "999999999999",
    agendaDetails: { auditObjectBin: "123456789012", auditObjectName: "Другой объект" },
    auditReportPoints: [report.points[0]], document: { ...source.document, date: "2026-10-04" },
  };
  const registered = { ...structuredClone(source), id: "linked", document: { ...source.document, sourceReportId: source.id } };
  const results = findWorkAuditReports([registered, source, other], "1-АО");
  assert.deepEqual(results.map(r => [r.sourceCaseId, r.number, r.points.length]), [
    [source.id, "1-АО", 17], [other.id, "1-АО", 1],
  ]);
  assert.equal(results[1].bin, "123456789012");
  assert.equal(results[1].address, "");
  assert.deepEqual(subjectAuditReports([registered], "subject2"), []);
});

test("при уточнении описания в ответ органа поступают исходные наименование и содержание выбранного пункта", () => {
  const state = initialState();
  const [report] = findWorkAuditReports(state.cases, "1-АО");
  const c = structuredClone(state.cases.find(item => item.id === report.sourceCaseId)!);
  const points = report.points.filter(p => p.number === "7" || p.number === "11.1");
  c.issues = points.map(p => ({
    id: p.id, number: p.number, ...workAuditPointSource(p), title: "Уточнённое описание",
    argument: "Довод из обращения", finding: "", disputed: true, amount: 0,
  }));
  const fields = actionForm("fill-request-response", c, state.date, {}, "dvga").fields;
  for (const p of points) {
    const value = (key: string) => fields.find(f => f.name === key + "_" + p.id)?.value;
    assert.equal(value("auditProgramName"), p.titleRu);
    assert.equal(value("auditProgramNameKk"), p.titleKk);
    assert.equal(value("authorityFinding"), p.auditReportPoint?.text ?? p.auditProgramResult?.answer);
    assert.equal(value("authorityFindingKk"), "");
  }
  const savedQuestion = c.issues.find(p => p.number === "11.1")!;
  points[1].auditProgramResult!.name = "Изменение источника";
  assert.equal(savedQuestion.auditProgramResult!.name, "Представительские расходы");
});
