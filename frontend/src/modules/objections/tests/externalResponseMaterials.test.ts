import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { applyAction } from "../services/workflow";
import CaseWorkspace from "../pages/CaseWorkspace";

test("фиксация внешнего ответа сохраняет реквизиты и историю без создания служебного документа", () => {
  let state = initialState();
  const c = state.cases[0];
  c.status = "request_approved";
  c.requests = [
    { id: "external", recipient: "АО ЦЭФ", date: state.date, sent: state.date, text: "", deadline: "", template: "other", lifecycleStatus: "waiting_response" },
    { id: "dvga", recipient: "ДВГА", date: state.date, sent: state.date, text: "", deadline: "", template: "dvga", lifecycleStatus: "waiting_response" },
  ];
  c.documents = [];
  const form = new FormData();
  form.set("externalRequestId", "external");
  form.set("responseRegistrationNumber", "ВХ-123");
  state = applyAction(state, c.id, "record-external-response", "work", form);
  const saved = state.cases.find(item => item.id === c.id)!;
  assert.equal(saved.requests[0].responseRegistrationNumber, "ВХ-123");
  assert.ok(saved.requests[0].responded);
  assert.match(saved.requests[0].responseNumber!, /\/1-О$/);
  assert.ok(saved.history.some(event => event.title === "Ответ АО ЦЭФ зафиксирован"));
  assert.ok(!saved.documents.some(document => document.name === "Ответ АО ЦЭФ"));
});

test("ранее созданная служебная запись скрыта в обоих блоках, файлы остаются доступными", () => {
  const c = initialState().cases[0];
  c.status = "materials";
  c.requests = [{ id: "external", recipient: "АО ЦЭФ", date: "2026-09-08", sent: "2026-09-08", responded: "2026-09-08", text: "", deadline: "", template: "other", registrationNumber: "ИСХ-1", responseRegistrationNumber: "ВХ-1" }];
  c.documents = [
    { name: "Ответ АО ЦЭФ", kind: "position", text: "Ответ зафиксирован", date: "2026-09-08", author: "Исполнитель", requestId: "external" },
    { name: "Запрос.pdf", kind: "request-attachment", text: "Запрос", date: "2026-09-08", author: "Исполнитель", requestId: "external", dataUrl: "data:application/pdf;base64,AA==" },
    { name: "Ответ.pdf", kind: "response-attachment", text: "Ответ", date: "2026-09-08", author: "Исполнитель", requestId: "external", dataUrl: "data:application/pdf;base64,AA==" },
  ];
  const html = renderToStaticMarkup(createElement(CaseWorkspace, { c, tab: "review", role: "work", onBack() {}, onTab() {}, onAction() {}, onDocument() {}, onUpload() {} }));
  for (const heading of ["Ответ других органов", "Запрос в другие органы"]) {
    const section = html.split(`<h4>${heading}</h4>`)[1].split("</section>")[0];
    assert.doesNotMatch(section, /Ответ АО ЦЭФ/);
    assert.match(section, heading.startsWith("Ответ") ? /Ответ\.pdf/ : /Запрос\.pdf/);
    assert.match(section, /Скачать/);
  }
  assert.equal(c.documents.length, 3);
});
