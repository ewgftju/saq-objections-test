import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { actionForm } from "../formDefinitions";
import { applyAction } from "../services/workflow";
import { DocumentContent } from "../components/DocumentModal";

test("мотивированный ответ по аудиторскому отчёту использует единое казахское наименование", () => {
  let state = initialState();
  const c = state.cases[0];
  c.appealType = "Возражение на аудиторский отчет"; c.status = "decided"; c.appealLanguage = "ru";
  c.orgTranslations = { ru: "Организация", kk: "Бастапқы атау" };
  c.issues = [];
  c.documentApplicantNames = { "final-response": { kk: "Старая форма адресата" } };
  const fields = actionForm("deliver", c, state.date, {}).fields;
  assert.equal(fields.find(field => field.name === "applicantName_kk")?.value, "Бастапқы атау");
  assert.ok(!fields.some(field => field.name === "documentApplicantName_kk"));
  const form = new FormData(); form.set("applicantName_kk", "Жаңа атау");
  state = applyAction(state, c.id, "deliver", "work", form);
  const saved = state.cases.find(item => item.id === c.id)!;
  const document = saved.documents.filter(item => item.kind === "final-response").at(-1)!;
  assert.equal(saved.orgTranslations?.kk, "Жаңа атау");
  assert.equal(document.snapshot?.documentApplicantNames?.["final-response"]?.kk, "Жаңа атау");
  const html = renderToStaticMarkup(createElement(DocumentContent, { c: saved, document, kind: "final-response", language: "ru" }));
  assert.match(html, /Жаңа атау/);
  assert.doesNotMatch(html, /Старая форма адресата/);
});

test("в проекте решения по жалобе отдельное поле адресата сохраняется", () => {
  const c = initialState().cases[0]; c.appealType = "Жалоба на уведомление";
  assert.ok(actionForm("create-decision-project", c, "2026-09-08", {}).fields.some(field => field.name === "documentApplicantName_kk"));
});
