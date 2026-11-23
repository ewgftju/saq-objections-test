import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import SubjectAppealStart from "../components/SubjectAppealStart";
import SubjectPrescriptionForm from "../components/SubjectPrescriptionForm";
import { subjectAppealHtml } from "../components/SubjectAppealDocument";
import { actionComplaintReport, newActionComplaintDraft } from "../services/subjectActionComplaint";
import { saveSubjectAppealDraft, submitSubjectAppeal, validateSubjectAppeal } from "../services/subjectAppeals";
import { auditAuthorityFullName } from "../../../utils/auditAuthority";
import { SUBJECT_2_PROFILE } from "../../../data/subjectProfiles";
import { evidenceDocumentsForPoint } from "../services/pointEvidence";
import CaseWorkspace from "../pages/CaseWorkspace";

function fixture() {
  const state = initialState();
  state.date = "2026-11-23";
  const draft = newActionComplaintDraft("action-draft-001");
  draft.auditAuthority = "ДВГА по г. Астана";
  draft.initialAppealNumber = "Исх-123";
  draft.initialAppealDate = "2026-10-12";
  draft.signerName = "Руководитель объекта";
  draft.postalAddress = "010000, Астана";
  draft.manualPoints = [
    { id: "manual-point-1", number: "1" },
    { id: "manual-point-2", number: "2" },
  ];
  draft.selectedPointIds = draft.manualPoints.map((point) => point.id);
  draft.argumentsByPoint = {
    "manual-point-1": "Обстоятельства по первому пункту",
    "manual-point-2": "Обстоятельства по второму пункту",
  };
  draft.attachments = draft.manualPoints.map((point) => ({
    id: "file-" + point.id,
    name: "Доказательство-" + point.number + ".pdf",
    size: 1,
    dataUrl: "data:application/pdf;base64,YQ==",
    pointId: point.id,
  }));
  return {state, draft};
}

test("жалоба на действие/бездействие доступна без выбора исходного документа ВГА", () => {
  const state = initialState();
  const start = renderToStaticMarkup(createElement(SubjectAppealStart, {
    state, role: "subject2", onClose() {}, onSave() {}, onSubmit() {},
  }));
  assert.match(start, /Жалоба на действие\/бездействие/);
  assert.doesNotMatch(start, /aria-label="Аудиторский отчёт"|aria-label="Предписание"/);
  const form = renderToStaticMarkup(createElement(SubjectPrescriptionForm, {
    state, role: "subject2", actionComplaint: true,
    onClose() {}, onSave() {}, onSubmit() {},
  }));
  assert.match(form, /Жалоба на действие\/бездействие — не связанная с ГЗ/);
  assert.match(form, /Номер первичного обращения в КВГА\/ДВГА/);
  assert.match(form, /Дата первичного обращения в КВГА\/ДВГА/);
  assert.match(form, /Орган аудита \(КВГА\/ДВГА\)/);
  assert.match(form, /ДВГА по г. Астана/);
  assert.match(form, /\+ Добавить пункт/);
  assert.doesNotMatch(form, /Выберите предписание|Выберите аудиторский отчёт/);
});

test("печатная жалоба использует выбранный орган в пункте 3 и строке Копия", () => {
  const {state, draft} = fixture();
  const source = actionComplaintReport(draft, state.date);
  const html = subjectAppealHtml(source, draft, state.date);
  const fullName = auditAuthorityFullName(draft.auditAuthority);
  assert.ok(html.includes(fullName));
  assert.ok(html.includes("Копия:"));
  assert.match(html, /На действия \(бездействие\) органа аудита по обращению/);
  assert.doesNotMatch(html, /по первичному обращению|Реквизиты первичного обращения/);
  assert.match(html, /Наименование заявителя:/);
  assert.match(html, /БИН:/);
  assert.ok(html.includes(SUBJECT_2_PROFILE.orgTranslations.ru.replaceAll('"', "&quot;")) ||
    html.includes(SUBJECT_2_PROFILE.orgTranslations.ru));
  assert.ok(html.includes(SUBJECT_2_PROFILE.bin));
  assert.ok(html.includes("3."));
  assert.ok(html.includes("Исх-123"));
  assert.ok(html.includes("12.10.2026"));
  assert.ok(html.includes("Обстоятельства по первому пункту"));
  assert.ok(html.includes("Доказательство-1.pdf"));
  assert.doesNotMatch(html, /На предписание об устранении нарушений|Связанный аудиторский отчёт/);
});

test("жалоба связывается с видом действие/бездействие и подвидом не связанная с ГЗ", () => {
  const {state, draft} = fixture();
  const before = structuredClone(state);
  const result = submitSubjectAppeal(state, draft, "subject2");
  const c = result.state.cases[0];
  assert.match(c.id, /^Ж-2026-/);
  assert.equal(c.type, "control");
  assert.equal(c.appealType, "Жалоба на действие/бездействие");
  assert.equal(c.agendaDetails?.actionComplaintSubtype, "non-procurement");
  assert.deepEqual(c.agendaDetails?.actionAppealAuthorities, [{
    issuer: draft.auditAuthority,
    documentNumber: draft.initialAppealNumber,
    documentDate: draft.initialAppealDate,
  }]);
  assert.equal(c.agendaDetails?.procurementNumber, undefined);
  assert.equal(c.issuer, draft.auditAuthority);
  assert.equal(c.document.name, "Первичное обращение в КВГА/ДВГА");
  assert.equal(c.document.number, draft.initialAppealNumber);
  assert.equal(c.document.date, draft.initialAppealDate);
  assert.deepEqual(c.issues.map(x => x.number), ["1","2"]);
  assert.deepEqual(c.issues.map(x => x.title), ["",""]);
  assert.ok(c.documents.some(doc => doc.text === "Требования заявителя"));
  assert.ok(result.state.notifications.some(n => n.caseId === c.id && n.recipientRole === "director"));
  assert.deepEqual(state,before);
});

test("сохранённый черновик жалобы открывается без документа ВГА и сохраняет добавленные пункты", () => {
  const {state,draft}=fixture();
  const saved=saveSubjectAppealDraft(state,draft,"subject2");
  const html=renderToStaticMarkup(createElement(SubjectAppealStart, {
    state:saved,role:"subject2",draftId:draft.id,onClose(){},onSave(){},onSubmit(){},
  }));
  assert.match(html,/Жалоба на действие\/бездействие/);
  assert.match(html,/Исх-123/);
  assert.match(html,/Номер пункта/);
  assert.match(html,/Обстоятельства по первому пункту/);
});

test("нельзя отправить жалобу без реквизитов, пункта, обстоятельств и доказательств", () => {
  const {state,draft}=fixture();
  const broken=structuredClone(draft);
  broken.auditAuthority="";
  assert.throws(()=>validateSubjectAppeal(broken,actionComplaintReport(broken,state.date),state.date),/Выберите орган аудита/);
  broken.auditAuthority=draft.auditAuthority;
  broken.manualPoints=[];
  assert.throws(()=>validateSubjectAppeal(broken,actionComplaintReport(broken,state.date),state.date),/Добавьте хотя бы один пункт/);
  broken.manualPoints=draft.manualPoints;
  broken.attachments=[];
  assert.throws(()=>validateSubjectAppeal(broken,actionComplaintReport(broken,state.date),state.date),/Приложите доказательства/);
});


test("пункт 1 печатной жалобы автоматически использует ФИО/наименование и ИИН/БИН из кабинета", () => {
  const { state, draft } = fixture();
  const report = actionComplaintReport(draft, state.date);
  assert.equal(report.org, SUBJECT_2_PROFILE.orgTranslations.ru);
  assert.equal(report.bin, SUBJECT_2_PROFILE.bin);
  assert.equal(report.identifierType, SUBJECT_2_PROFILE.identifierType);
  const html = subjectAppealHtml(report, draft, state.date);
  assert.match(html, /1\. Фамилия, имя, отчество/);
  assert.match(html, /Наименование заявителя:/);
  assert.match(html, /БИН:/);
  assert.match(html, /001002003004/);
  assert.doesNotMatch(html, /Реквизиты первичного обращения/);
  const individualHtml = subjectAppealHtml({
    ...report, identifierType: "ИИН", bin: "123456789012", org: "Иванов Иван Иванович",
    orgTranslations: undefined,
  }, draft, state.date);
  assert.match(individualHtml, /ФИО заявителя:/);
  assert.match(individualHtml, /ИИН:/);
  assert.match(individualHtml, /123456789012/);
});

test("карточки пункта 4 отображают введённый номер пункта, а не порядковый номер карточки", () => {
  const { state, draft } = fixture();
  draft.manualPoints![0].number = "5";
  const saved = saveSubjectAppealDraft(state, draft, "subject2");
  const html = renderToStaticMarkup(createElement(SubjectPrescriptionForm, {
    state: saved, role: "subject2", draftId: draft.id, actionComplaint: true,
    onClose() {}, onSave() {}, onSubmit() {},
  }));
  assert.match(html, /subject-appeal-manual-point-header/);
  assert.match(html, /subject-appeal-remove-point/);
  assert.match(html, /Пункт 5/);
  assert.match(html, /Номер пункта 5/);
  assert.match(html, /Удалить пункт 5/);
  assert.match(html, /Обоснование по пункту 5/);
  assert.match(html, /Пункт 2/);
  assert.doesNotMatch(html, /<h4>Пункт 1<\/h4>/);
  assert.match(html, /subject-appeal-add-manual-point/);
});


test("доказательства в пунктах 5 и 6 не смешиваются даже при одинаковом имени файла", () => {
  const { state, draft } = fixture();
  draft.manualPoints = [
    { id: "manual-point-1", number: "5" },
    { id: "manual-point-2", number: "6" },
  ];
  draft.attachments = [
    {
      id: "doc-for-5", pointId: "manual-point-1", name: "Тест 01.docx",
      dataUrl: "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,YQ==",
      size: 1,
    },
    {
      id: "doc-for-6", pointId: "manual-point-2", name: "Тест 01.docx",
      dataUrl: "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,Yg==",
      size: 1,
    },
  ];
  const { state: submitted, caseId } = submitSubjectAppeal(state, draft, "subject2");
  const c = submitted.cases.find(item => item.id === caseId)!;
  const p5 = c.issues.find(point => point.number === "5")!;
  const p6 = c.issues.find(point => point.number === "6")!;

  assert.deepEqual(p5.evidenceAttachmentIds, ["doc-for-5"]);
  assert.deepEqual(p6.evidenceAttachmentIds, ["doc-for-6"]);
  const docs5 = evidenceDocumentsForPoint(p5, c.documents);
  const docs6 = evidenceDocumentsForPoint(p6, c.documents);
  assert.deepEqual(docs5.map(doc => doc.evidenceAttachmentId), ["doc-for-5"]);
  assert.deepEqual(docs6.map(doc => doc.evidenceAttachmentId), ["doc-for-6"]);
  assert.notEqual(docs5[0].dataUrl, docs6[0].dataUrl);
  assert.equal(docs5[0].evidencePointId, p5.id);
  assert.equal(docs6[0].evidencePointId, p6.id);

  const view = renderToStaticMarkup(createElement(CaseWorkspace, {
    c, role: "work", tab: "overview",
    onBack() {}, onTab() {}, onAction() {}, onDocument() {}, onUpload() {},
  }));
  const index5 = view.indexOf("Пункт 5 ·");
  const index6 = view.indexOf("Пункт 6 ·");
  assert.ok(index5 !== -1 && index6 > index5);
  const card5 = view.slice(index5, index6);
  const card6 = view.slice(index6);
  assert.ok(card5.includes(docs5[0].dataUrl!));
  assert.ok(!card5.includes(docs6[0].dataUrl!));
  assert.ok(card6.includes(docs6[0].dataUrl!));
  assert.ok(!card6.includes(docs5[0].dataUrl!));

  // Старые обращения сохранили привязку в text, без новых идентификаторов.
  const oldCase = structuredClone(c);
  for (const point of oldCase.issues) delete point.evidenceAttachmentIds;
  for (const document of oldCase.documents) {
    delete document.evidenceAttachmentId;
    delete document.evidencePointId;
  }
  const oldP5 = oldCase.issues.find(point => point.number === "5")!;
  const oldP6 = oldCase.issues.find(point => point.number === "6")!;
  assert.equal(evidenceDocumentsForPoint(oldP5, oldCase.documents).length, 1);
  assert.equal(evidenceDocumentsForPoint(oldP6, oldCase.documents).length, 1);
  assert.equal(evidenceDocumentsForPoint(oldP5, oldCase.documents)[0].dataUrl, docs5[0].dataUrl);
  assert.equal(evidenceDocumentsForPoint(oldP6, oldCase.documents)[0].dataUrl, docs6[0].dataUrl);
});

test("пункт получает только свой отдельный файл при разных именах", () => {
  const { state, draft } = fixture();
  draft.manualPoints = [
    { id: "manual-point-1", number: "5" },
    { id: "manual-point-2", number: "6" },
  ];
  draft.attachments[0].name = "Для пункта 5.docx";
  draft.attachments[1].name = "Для пункта 6.docx";
  const result = submitSubjectAppeal(state, draft, "subject2");
  const c = result.state.cases.find(item => item.id === result.caseId)!;
  const p5 = c.issues.find(point => point.number === "5")!;
  const p6 = c.issues.find(point => point.number === "6")!;
  assert.deepEqual(evidenceDocumentsForPoint(p5, c.documents).map(doc => doc.name), ["Для пункта 5.docx"]);
  assert.deepEqual(evidenceDocumentsForPoint(p6, c.documents).map(doc => doc.name), ["Для пункта 6.docx"]);
});
