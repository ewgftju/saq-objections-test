import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { actionForm } from "../formDefinitions";
import { DocumentContent } from "../components/DocumentModal";
import { AgendaDocument } from "../components/AgendaModal";
import { applyAction } from "../services/workflow";

test("отдельная форма наименования сохраняется в справке, не меняя карточку и старую версию", () => {
  let state = initialState();
  const c = state.cases[0]; c.status = "materials"; c.appealLanguage = "ru"; c.appealType = "Возражение на аудиторский отчет";
  c.org = "Исходное название"; c.orgTranslations = { ru: c.org, kk: "Бастапқы атауы" };
  c.issues = [{ ...c.issues.find(p => p.disputed)!, id: "p1", number: "1", title: "Описание", argument: "Довод" }];
  const field = actionForm("analysis", c, state.date, { documentLanguageMode: "ru" }).fields.find(f => f.name === "documentApplicantName_ru");
  assert.equal(field?.value, "Исходное название");
  const form = new FormData(); form.set("documentLanguageMode", "ru"); form.set("davgaArguments_p1", "Доводы"); form.set("documentApplicantName_ru", "Исходного названия");
  state = applyAction(state, c.id, "analysis", "work", form);
  const saved = state.cases.find(x => x.id === c.id)!;
  assert.equal(saved.org, "Исходное название"); assert.equal(saved.orgTranslations?.ru, "Исходное название");
  const doc = [...saved.documents].reverse().find(x => x.kind === "certificate")!;
  assert.equal(doc.snapshot?.documentApplicantNames?.certificate?.ru, "Исходного названия");
  saved.documentApplicantNames = { certificate: { ru: "Другая форма" } };
  const html = renderToStaticMarkup(createElement(DocumentContent, { c: saved, kind: "certificate", document: doc }));
  assert.match(html, /Исходного названия/); assert.doesNotMatch(html, /Другая форма/);
});

test("наименование в повестке редактируется отдельно от карточки", () => {
  const c = initialState().cases[0]; c.org = "Исходное название"; c.orgTranslations = { ru: c.org };
  const html = renderToStaticMarkup(createElement(AgendaDocument, { cases: [c], meetingDate: "2026-11-09", applicantNames: { [c.id]: "Исходного названия" } }));
  assert.match(html, /Исходного названия/); assert.equal(c.org, "Исходное название"); assert.equal(c.orgTranslations.ru, "Исходное название");
});

test("повестка использует русскую форму из справки и исходное имя при её отсутствии", () => {
  const c = initialState().cases[0]; c.appealLanguage = "kk"; c.org = "Қазақша атауы";
  c.orgTranslations = { kk: c.org, ru: "Организация" };
  c.documentApplicantNames = { certificate: { ru: "Организации", kk: "Ұйымның" } };
  const html = renderToStaticMarkup(createElement(AgendaDocument, { cases: [c], meetingDate: "2026-11-09" }));
  assert.match(html, /Организации/); assert.doesNotMatch(html, /Ұйымның/);
  c.documentApplicantNames = { certificate: { kk: "Ұйымның" } };
  const fallback = renderToStaticMarkup(createElement(AgendaDocument, { cases: [c], meetingDate: "2026-11-09" }));
  assert.match(fallback, /Организация/);
});
