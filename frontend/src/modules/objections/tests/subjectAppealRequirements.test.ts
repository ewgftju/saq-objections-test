import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import type { DocumentLanguage, ObjectionCase, Role } from "../../../types";
import CaseWorkspace from "../pages/CaseWorkspace";
import { subjectAppealHtml } from "../components/SubjectAppealDocument";
import { createSubjectAppealDraft, subjectAuditReports, submitSubjectAppeal } from "../services/subjectAppeals";
import { subjectPrescriptions } from "../services/subjectPrescriptions";
import { applicantRequirementFiles } from "../services/subjectAppealRequirements";

function submittedCase(prescription: boolean, language: DocumentLanguage) {
  const state = initialState();
  const report = prescription
    ? subjectPrescriptions(state, "subject2")[0]
    : subjectAuditReports(state.cases, "subject2")[0];
  if (!prescription) state.date = report.signedReportPresentedAt ?? report.received;
  const draft = createSubjectAppealDraft(report, "requirements-draft");
  draft.language = language;
  draft.signerName = "Тестовый руководитель";
  draft.place = "Астана";
  draft.selectedPointIds = [report.points[0].id];
  draft.argumentsByPoint = { [report.points[0].id]: "Довод заявителя / Өтініш берушінің уәжі" };
  draft.attachments = [{ id: "proof", name: "Доказательство.pdf", size: 1, dataUrl: "data:application/pdf;base64,YQ==", pointId: report.points[0].id }];
  const result = submitSubjectAppeal(state, draft, "subject2");
  return { ...result, c: result.state.cases.find(c => c.id === result.caseId)! };
}

function card(c: ObjectionCase, role: Role) {
  return renderToStaticMarkup(createElement(CaseWorkspace, {
    c, role, tab: "overview", onBack() {}, onTab() {}, onAction() {}, onDocument() {}, onUpload() {},
  }));
}

for (const prescription of [false, true]) {
  for (const language of ["ru", "kk"] as const) {
    test(`${prescription ? "жалоба" : "возражение"}, ${language}: поданная форма вложена в требования и доступна в карточке`, () => {
      const { state, caseId, c } = submittedCase(prescription, language);
      // Файл переживает сохранение и восстановление состояния макета.
      const restored = JSON.parse(JSON.stringify(c)) as ObjectionCase;
      const files = applicantRequirementFiles(restored);
      assert.equal(files.length, 1);
      const file = files[0];
      assert.ok(restored.documents.some(d => d.dataUrl === file.dataUrl));
      assert.equal(file.text, "Требования заявителя");
      assert.deepEqual(file.languages, [language]);
      const saved = restored.subjectAppeal!;
      const html = decodeURIComponent(file.dataUrl!.split(",").slice(1).join(","));
      assert.equal(html, subjectAppealHtml(saved.report, saved.draft, saved.submittedAt, true));
      assert.match(html, /Тестовый руководитель/);
      assert.match(html, /Доказательство.pdf/);
      assert.equal(restored.documents.filter(d => d.filename === "Доказательство.pdf").length, 1);
      for (const role of ["subject2", "work", "director"] as const) {
        const view = card(restored, role);
        assert.match(view, /Требования заявителя/);
        assert.ok(view.includes(`download="${file.filename}"`));
      }
      const repeated = submitSubjectAppeal(state, saved.draft, "subject2");
      assert.equal(repeated.caseId, caseId);
      assert.equal(applicantRequirementFiles(repeated.state.cases.find(c => c.id === caseId)!).length, 1);
    });
  }
}

test("ранее поданные обращения получают форму в требованиях без потери других файлов", () => {
  const { c } = submittedCase(false, "kk");
  c.documents = c.documents.filter(d => !d.subjectAppealId);
  const uploaded = { kind: "attachment", name: "Требования.pdf", filename: "Требования.pdf", text: "Требования заявителя", dataUrl: "data:application/pdf;base64,YQ==", date: c.registered, author: c.org };
  c.documents.push(uploaded);
  const before = structuredClone(c);
  const files = applicantRequirementFiles(c);
  assert.equal(files.length, 2);
  assert.equal(files[0], uploaded);
  assert.ok(files[1].dataUrl?.startsWith("data:text/html"));
  assert.ok(card(c, "work").includes(`download="${files[1].filename}"`));
  assert.deepEqual(c, before);
  delete c.subjectAppeal;
  assert.deepEqual(applicantRequirementFiles(c), [uploaded]);
});
