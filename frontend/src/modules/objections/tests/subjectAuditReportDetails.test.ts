import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import type { DocumentLanguage, Role } from "../../../types";
import { SUBJECT_2_PROFILE } from "../../../data/subjectProfiles";
import SubjectAppealForm from "../components/SubjectAppealForm";
import { subjectAppealHtml } from "../components/SubjectAppealDocument";
import { isApplicantCase } from "../services/subjectRegistry";
import { saveSubjectIssueDescription } from "../services/subjectPrescriptions";
import CaseWorkspace from "../pages/CaseWorkspace";
import { actionForm } from "../formDefinitions";
import { DocumentContent } from "../components/DocumentModal";
import {
  createSubjectAppealDraft,
  localizeSubjectAppealDraft,
  refreshSubjectAppealDraftSource,
  reportFingerprint,
  saveSubjectAppealDraft,
  subjectAuditReports,
  submitSubjectAppeal,
} from "../services/subjectAppeals";

function fixture(language: DocumentLanguage = "ru") {
  const state = initialState();
  const report = subjectAuditReports(state.cases, "subject2").find(r => r.number === "1-АО" && r.date === "2026-09-05")!;
  const draft = localizeSubjectAppealDraft(createSubjectAppealDraft(report, "vga-details-" + language), report, language);
  const pointId = report.points.find(point => point.auditProgramResult)!.id;
  draft.selectedPointIds = [pointId];
  draft.argumentsByPoint = { [pointId]: "Обстоятельства заявителя" };
  draft.attachments = [{ id: "proof", pointId, name: "Доказательство.pdf", size: 1, dataUrl: "data:application/pdf;base64,YQ==" }];
  return { state, report, draft };
}

test("реквизиты и руководитель ВГА заполняют форму на выбранном языке, профиль кабинета не изменяется", () => {
  for (const language of ["ru", "kk"] as const) {
    const { state, report, draft } = fixture(language);
    assert.equal(report.bin, "001002003004");
    assert.equal(draft.signerName, "Ахметов Аслан Ерланович");
    assert.equal(draft.signerPosition, language === "ru" ? "Первый руководитель" : "Бірінші басшы");
    assert.equal(draft.place, language === "ru" ? "г. Астана, ул. Учебная, 1" : "Астана қ., Учебная к., 1");
    state.subjectAppealDrafts = [draft];
    const editor = renderToStaticMarkup(createElement(SubjectAppealForm, { state, role: "subject2", draftId: draft.id, onClose() {}, onSave() {}, onSubmit() {} }));
    const printed = subjectAppealHtml(report, draft, state.date);
    for (const html of [editor, printed]) {
      assert.ok(html.includes(language === "ru" ? "ГУ «Учебный центр инфраструктуры»" : "«Инфрақұрылым оқу орталығы» ММ"));
      assert.ok(html.includes(draft.place));
      assert.ok(html.includes(draft.signerName));
      assert.ok(html.includes(draft.signerPosition));
      assert.doesNotMatch(html, /Из кабинета объекта заявителя|Audit plus/);
      assert.doesNotMatch(html, /Нарушение, по которому поступило возражение|Қарсылық келіп түскен бұзушылық|Ответ на вопрос программы аудита|subject-appeal-source-answer/);
      assert.ok(!html.includes(report.points.find(point => point.auditProgramResult)!.auditProgramResult!.answer));
    }
    assert.equal(SUBJECT_2_PROFILE.orgTranslations.ru, 'Товарищество с ограниченной ответственностью "Audit plus #1"');
    assert.equal(state.cases.find(c => c.id === report.sourceCaseId)!.org, SUBJECT_2_PROFILE.orgTranslations.ru);
  }
});

test("смена языка меняет подставленные должность и адрес, ручные значения сохраняются", () => {
  const { report, draft } = fixture();
  const kk = localizeSubjectAppealDraft(draft, report, "kk");
  assert.equal(kk.signerPosition, "Бірінші басшы");
  assert.equal(kk.place, "Астана қ., Учебная к., 1");
  assert.equal(localizeSubjectAppealDraft(kk, report, "ru").signerPosition, "Первый руководитель");
  const edited = localizeSubjectAppealDraft({ ...draft, signerPosition: "Исполняющий обязанности", place: "Место составления, указанное вручную" }, report, "kk");
  assert.equal(edited.signerPosition, "Исполняющий обязанности");
  assert.equal(edited.place, "Место составления, указанное вручную");
});

test("черновик обновляет прежние реквизиты заглушки без потери доводов и файлов; изменение вопросов требует проверки", () => {
  const { state, report, draft } = fixture();
  const prior = structuredClone(report);
  prior.org = SUBJECT_2_PROFILE.orgTranslations.ru;
  prior.orgTranslations = { ...SUBJECT_2_PROFILE.orgTranslations };
  prior.address = "г. Алматы";
  delete prior.addressTranslations;
  delete prior.signerName;
  delete prior.signerPositionTranslations;
  const old = { ...draft, sourceFingerprint: reportFingerprint(prior), signerName: "", signerPosition: "Руководитель", place: "г. Алматы" };
  const refreshed = refreshSubjectAppealDraftSource(old, report);
  assert.equal(refreshed.signerName, "Ахметов Аслан Ерланович");
  assert.equal(refreshed.signerPosition, "Первый руководитель");
  assert.equal(refreshed.place, report.address);
  assert.deepEqual(refreshed.argumentsByPoint, draft.argumentsByPoint);
  assert.deepEqual(refreshed.attachments, draft.attachments);
  assert.doesNotThrow(() => saveSubjectAppealDraft(state, refreshed, "subject2"));
  assert.equal(old.sourceFingerprint, reportFingerprint(prior));
  const changed = structuredClone(report);
  changed.points[0].title = "Изменённый вопрос программы аудита";
  const stale = refreshSubjectAppealDraftSource({ ...draft, sourceFingerprint: reportFingerprint(changed) }, report);
  assert.equal(stale.sourceFingerprint, reportFingerprint(changed));
  assert.throws(() => saveSubjectAppealDraft(state, stale, "subject2"), /Реквизиты отчёта изменились/);
});

test("карточка и поданная форма фиксируют реквизиты ВГА и доступны отправившему кабинету", () => {
  for (const language of ["ru", "kk"] as const) {
    const { state, report, draft } = fixture(language);
    const { state: saved, caseId } = submitSubjectAppeal(state, draft, "subject2");
    const c = saved.cases.find(item => item.id === caseId)!;
    assert.equal(c.org, report.orgTranslations![language]);
    assert.equal(c.address, report.addressTranslations![language]);
    assert.equal(c.bin, "001002003004");
    assert.equal(c.agendaDetails?.auditObjectName, c.org);
    assert.equal(c.subjectAppeal?.draft.signerPosition, draft.signerPosition);
    assert.equal(isApplicantCase(c, "subject2"), true);
    assert.equal(isApplicantCase(c, "subject"), false);
    report.orgTranslations![language] = "Позднее изменение ВГА";
    report.addressTranslations![language] = "Позднее изменение адреса";
    report.signerPositionTranslations![language] = "Позднее изменение должности";
    assert.notEqual(c.subjectAppeal!.report.orgTranslations![language], report.orgTranslations![language]);
    assert.notEqual(c.subjectAppeal!.report.addressTranslations![language], report.addressTranslations![language]);
    assert.equal(c.subjectAppeal!.draft.signerPosition, draft.signerPosition);
  }
});

test("оба вопроса программы поступают в нарушение двумя полями, описание вопроса пустое на обоих языках", () => {
  for (const language of ["ru", "kk"] as const) {
    const { state, report, draft } = fixture(language);
    const questions = report.points.filter(point => point.auditProgramResult);
    draft.selectedPointIds = questions.map(point => point.id);
    draft.argumentsByPoint = Object.fromEntries(questions.map(point => [point.id, `Довод ${point.number}`]));
    draft.attachments = questions.map(point => ({ ...draft.attachments[0], id: `proof-${point.id}`, pointId: point.id }));
    const { state: saved, caseId } = submitSubjectAppeal(state, draft, "subject2");
    const c = saved.cases.find(item => item.id === caseId)!;
    c.requests = [{ id: "request", recipient: c.issuer, template: "dvga", date: state.date, sent: state.date, deadline: state.date, text: "Запрос" }];
    for (const [index, point] of c.issues.entries()) {
      assert.equal(point.title, "");
      assert.deepEqual(point.translations, {});
      assert.deepEqual(point.auditProgramResult, questions[index].auditProgramResult);
      assert.equal(point.argument, draft.argumentsByPoint[point.id]);
    }
    for (const role of ["dvga", "kvga"] as const) {
      const fields = actionForm("fill-request-response", c, state.date, {}, role).fields;
      for (const point of c.issues) {
        assert.equal(fields.find(f => f.name === `auditProgramName_${point.id}`)?.value, point.auditProgramResult!.name);
        assert.equal(fields.find(f => f.name === `authorityFinding_${point.id}`)?.value, point.auditProgramResult!.answer);
        assert.equal(fields.find(f => f.name === `auditProgramNameKk_${point.id}`)?.value, "");
        assert.equal(fields.find(f => f.name === `authorityFindingKk_${point.id}`)?.value, "");
      }
    }
    const request = renderToStaticMarkup(createElement(DocumentContent, { c, kind: "request-appendix" }));
    for (const point of c.issues) {
      assert.equal(request.includes(point.auditProgramResult!.name), language === "ru");
      assert.equal(request.includes(point.auditProgramResult!.answer), language === "ru");
    }
    assert.ok(request.includes("Наименование вопроса программы аудита:"));
    assert.ok(request.includes("Ответ на вопрос программы аудита:"));
    const view = renderToStaticMarkup(createElement(CaseWorkspace, { c, role: "director", tab: "overview", onBack() {}, onTab() {}, onAction() {}, onDocument() {}, onUpload() {} }));
    assert.ok(view.includes(`Описание оспариваемого вопроса — ${language === "ru" ? "Русский" : "Қазақша"}:</b> —`));
    for (const point of c.issues) assert.ok(view.includes(`<b>Наименование вопроса программы аудита:</b> ${point.auditProgramResult!.name}`));
  }
});

test("описание аудиторского вопроса заполняет рабочий орган после назначения, нарушение и подписанная форма сохраняются", () => {
  for (const language of ["ru", "kk"] as const) {
    const { state, draft } = fixture(language);
    const { state: saved, caseId } = submitSubjectAppeal(state, draft, "subject2");
    const c = saved.cases.find(item => item.id === caseId)!;
    const pointId = c.issues[0].id;
    assert.throws(() => saveSubjectIssueDescription(saved, caseId, pointId, "Описание", "work"), /после назначения/);
    c.status = "accepted";
    for (const role of ["subject2", "director", "dvga", "kvga"] as Role[]) {
      assert.throws(() => saveSubjectIssueDescription(saved, caseId, pointId, "Описание", role), /исполнитель рабочего органа/);
    }
    const snapshot = structuredClone(c);
    const next = saveSubjectIssueDescription(saved, caseId, pointId, "Описание рабочего органа", "work");
    const updated = next.cases.find(item => item.id === caseId)!;
    assert.equal(updated.issues[0].title, "Описание рабочего органа");
    assert.equal(updated.issues[0].translations?.[language]?.title, "Описание рабочего органа");
    assert.deepEqual(updated.issues[0].auditProgramResult, snapshot.issues[0].auditProgramResult);
    assert.equal(updated.issues[0].argument, snapshot.issues[0].argument);
    assert.deepEqual(updated.subjectAppeal, snapshot.subjectAppeal);
    assert.deepEqual(updated.documents, snapshot.documents);
    assert.equal(c.issues[0].title, "");
  }
});
