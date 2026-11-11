import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { actionForm } from "../formDefinitions";
import { applyAction } from "../services/workflow";
import { DocumentContent } from "../components/DocumentModal";

test("перевод предмета в запросе сохраняется, используется и фиксируется в документе", () => {
  let state = initialState(); const c = state.cases[0];
  c.status = "accepted"; c.appealType = "Жалоба на действие/бездействие"; c.appealLanguage = "ru";
  c.agendaDetails = { procurementNumber: "123", procurementSubject: "Строительство" };
  const field = actionForm("request", c, state.date, {}).fields.find(f => f.name === "procurementSubject_kk");
  assert.equal(field?.label, "Предмет — Қазақша"); assert.equal(field?.value, "");
  const form = new FormData(); form.set("recipient", "КВГА"); form.set("applicantName_kk", "Ұйым"); form.set("documentApplicantName_kk", "Ұйымның"); form.set("procurementSubject_kk", "Мектеп құрылысы");
  state = applyAction(state, c.id, "request", "work", form);
  const saved = state.cases.find(item => item.id === c.id)!; const doc = saved.documents.findLast(item => item.kind === "request")!;
  assert.equal(saved.agendaDetails?.procurementSubject, "Строительство");
  assert.equal(saved.agendaDetails?.procurementSubjectTranslations?.kk, "Мектеп құрылысы");
  assert.equal(actionForm("request", saved, state.date, {}).fields.find(f => f.name === "procurementSubject_kk")?.value, "Мектеп құрылысы");
  assert.equal(actionForm("analysis", saved, state.date, { documentLanguageMode: "kk" }).fields.find(f => f.name === "procurementSubject_kk")?.value, "Мектеп құрылысы");
  assert.match(renderToStaticMarkup(createElement(DocumentContent, { c: saved, kind: "request", document: doc })), /сатып алу заты: Мектеп құрылысы/);
  saved.agendaDetails!.procurementSubjectTranslations!.kk = "Басқа";
  assert.match(renderToStaticMarkup(createElement(DocumentContent, { c: saved, kind: "request", document: doc })), /сатып алу заты: Мектеп құрылысы/);
  c.appealLanguage = "kk";
  assert.ok(!actionForm("request", c, state.date, {}).fields.some(f => f.name === "procurementSubject_kk"));
});

test("если перевода нет, поле доступно при формировании казахского протокола", () => {
  const state = initialState(), c = state.cases[0];
  c.appealType = "Жалоба на действие/бездействие"; c.appealLanguage = "ru";
  c.agendaDetails = { procurementSubject: "Строительство" };
  assert.ok(actionForm("vote", c, state.date, { documentLanguageMode: "kk" }).fields.some(f => f.name === "procurementSubject_kk"));
  assert.ok(!actionForm("vote", c, state.date, { documentLanguageMode: "ru" }).fields.some(f => f.name === "procurementSubject_kk"));
  c.agendaDetails.procurementSubjectTranslations = { kk: "Құрылыс" };
  assert.ok(!actionForm("vote", c, state.date, { documentLanguageMode: "kk" }).fields.some(f => f.name === "procurementSubject_kk"));
});
