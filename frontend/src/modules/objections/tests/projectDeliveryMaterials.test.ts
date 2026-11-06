import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import CaseWorkspace from "../pages/CaseWorkspace";

test("внешнее направление проекта решения видно с реквизитами и подтверждением", () => {
  const c = initialState().cases[0];
  c.status = "decision_project_comments";
  c.decisionProjectRouting = { channel: "external", sentAt: "2026-09-08", deliveryPath: "СЭД", registrationNumber: "123-2", recipients: [{ id: "subject", recipient: "Тестовый заявитель", purpose: "comments", channel: "external", status: "sent" }] };
  c.documents.push({ kind: "decision-project", name: "Подписанный проект решения", text: "", date: "2026-09-08", author: "Рабочий орган" });
  c.documents.push({ kind: "decision-project-delivery-attachment", name: "Подтверждение.docx", filename: "Подтверждение.docx", text: "", date: "2026-09-08", author: "Рабочий орган", dataUrl: "data:text/plain;base64,YQ==" });
  const render = (role: "work" | "commission") => renderToStaticMarkup(createElement(CaseWorkspace, { c, role, tab: "review", onBack() {}, onTab() {}, onAction() {}, onDocument() {}, onUpload() {} }));
  const html = render("work");
  assert.match(html, /Направление проекта решения/);
  assert.match(html, /Тестовый заявитель<small>Направлен · 08.09.2026 · СЭД · №123-2/);
  assert.match(html, /Подтверждение.docx/);
  assert.ok(html.indexOf("Направление проекта решения") < html.indexOf("Подписанный проект решения"));
  assert.doesNotMatch(render("commission"), /Направление проекта решения/);
  c.decisionProjectRouting.channel = "saq";
  assert.doesNotMatch(render("work"), /Направление проекта решения/);
});
