import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import ActionModal from "../components/ActionModal";

test("решение директора выбирается отдельно под текстами по каждому пункту и языку", () => {
  const state = initialState(); const c = state.cases[0];
  c.status = "meeting";
  c.certificateChangeRequests = [{ stage: "protocol", proposedAt: "2026-09-01T10:00:00Z", proposedBy: "Исполнитель", reason: "Причина предложения", status: "pending", changes: [
    { pointId: "p1", pointNumber: "1", language: "ru", before: "Исходный текст", proposed: "Новый текст" },
    { pointId: "p1", pointNumber: "1", language: "kk", before: "Ұзын мәтін ".repeat(100), proposed: "Жаңа мәтін" },
  ] }];
  const html = renderToStaticMarkup(createElement(ActionModal, { c, action: "review-certificate-change", role: "director", date: state.date, onSubmit() {}, onClose() {} }));
  assert.match(html, /Причина предложения/);
  assert.doesNotMatch(html, /name="proposalReason"/);
  assert.match(html, /Пункт № 1 · Русский/); assert.match(html, /Пункт № 1 · Қазақша/);
  assert.ok(html.indexOf("Исходный текст") < html.indexOf("Новый текст"));
  assert.match(html, /name="decision_p1"/); assert.match(html, /name="decision_p1_kk"/);
  assert.match(html, /Показать полностью/); assert.match(html, /name="reviewComment"/);
  assert.doesNotMatch(html, /name="before_p1|name="proposed_p1|<del|<ins/);
});
