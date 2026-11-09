import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { actionForm } from "../formDefinitions";
import { AgendaDocument } from "../components/AgendaModal";
import { applyAction } from "../services/workflow";

for (const type of ["Заявление", "Жалоба на действие/бездействие"] as const) test(`${type}: русские данные для повестки сохраняются при казахской справке`, () => {
  let state = initialState(); const c = state.cases[0];
  c.status = "materials"; c.appealLanguage = "kk"; c.appealType = type; c.org = "Қазақша ұйым"; c.orgTranslations = { kk: c.org };
  c.request = "Қазақша өтініш";
  c.agendaDetails = { procurementNumber: "55", procurementSubject: "Қазақша нысанасы" };
  const point = { ...c.issues.find(item => item.disputed)!, id: "p1", number: "1", title: "Қазақша тармақ", argument: "Өтініш дәлелі" }; c.issues = [point];
  const fields = actionForm("analysis", c, state.date, { documentLanguageMode: "kk" }).fields;
  assert.ok(fields.some(field => field.name === "agendaApplicantRu" && !field.required));
  assert.ok(fields.some(field => field.name === (type === "Заявление" ? "agendaStatementRu" : "agendaProcurementRu") && !field.required));
  assert.ok(!fields.some(field => field.name.startsWith("pointTitle_ru")));
  const form = new FormData(); form.set("documentLanguageMode", "kk"); form.set("davgaArgumentsKk_p1", "Қазақша дәлел"); form.set("agendaApplicantRu", "Русская организация"); form.set("documentApplicantName_ru", "Русской организации");
  if (type === "Заявление") form.set("agendaStatementRu", "Русское содержание заявления");
  else form.set("agendaProcurementRu", "Русский предмет закупки");
  state = applyAction(state, c.id, "analysis", "work", form);
  const saved = state.cases.find(item => item.id === c.id)!;
  assert.deepEqual(saved.certificate?.languages, ["kk"]);
  assert.equal(saved.org, "Қазақша ұйым"); assert.equal(saved.orgTranslations?.ru, "Русская организация");
  const html = renderToStaticMarkup(createElement(AgendaDocument, { cases: [saved], meetingDate: state.date }));
  assert.match(html, /Русской организации/);
  assert.ok(html.includes(type === "Заявление" ? "Русское содержание заявления" : "Русский предмет закупки"));
  const later = actionForm("analysis", saved, state.date, { documentLanguageMode: "kk" }).fields;
  assert.ok(!later.some(field => field.name === "agendaApplicantRu" || field.name === "agendaStatementRu" || field.name === "agendaProcurementRu"));
});

test("для казахской справки требуется наименование для русской повестки", () => {
  let state = initialState(); const c = state.cases[0]; c.status = "materials"; c.appealLanguage = "kk"; c.appealType = "Заявление"; c.request = "Қазақша өтініш";
  const point = { ...c.issues.find(item => item.disputed)!, id: "p1", title: "Қазақша тармақ", argument: "Дәлел" }; c.issues = [point];
  const form = new FormData(); form.set("documentLanguageMode", "kk"); form.set("davgaArgumentsKk_p1", "Дәлел");
  assert.throws(() => applyAction(state, c.id, "analysis", "work", form), /наименовани.*повестки/i);
  form.set("documentApplicantName_ru", "Русской организации");
  state = applyAction(state, c.id, "analysis", "work", form);
  assert.deepEqual(state.cases.find(item => item.id === c.id)?.certificate?.languages, ["kk"]);
});
