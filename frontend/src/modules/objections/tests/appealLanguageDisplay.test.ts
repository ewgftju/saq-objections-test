import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import CaseWorkspace from "../pages/CaseWorkspace";

test("язык обращения виден в шапке карточки", () => {
  const state = initialState();
  const c = state.cases[0];
  c.appealType = "Жалоба на уведомление";
  for (const [language, label] of [["ru", "русский"], ["kk", "казахский"], [undefined, "не указан"]] as const) {
    c.appealLanguage = language;
    const workspace = renderToStaticMarkup(createElement(CaseWorkspace, { c, role: "work", tab: "review", onBack() {}, onTab() {}, onAction() {}, onDocument() {}, onUpload() {} }));
    assert.ok(workspace.includes(`Язык обращения: ${label}`));

  }
});


test("ДВГА и КВГА не видят язык обращения в карточке", () => {
  const state = initialState();
  const c = state.cases[0];
  c.appealLanguage = "kk";
  for (const role of ["dvga", "kvga"] as const) for (const tab of ["overview", "review"] as const) {
    const html = renderToStaticMarkup(createElement(CaseWorkspace, { c, role, tab, onBack() {}, onTab() {}, onAction() {}, onDocument() {}, onUpload() {} }));
    assert.doesNotMatch(html, /Язык обращения/);
    assert.ok(html.includes(c.id));
  }
  const work = renderToStaticMarkup(createElement(CaseWorkspace, { c, role: "work", tab: "overview", onBack() {}, onTab() {}, onAction() {}, onDocument() {}, onUpload() {} }));
  assert.match(work, /Язык обращения/);
});


test("члены АК не видят язык обращения в карточке", () => {
  const state = initialState();
  const c = state.cases[0];
  c.appealLanguage = "kk";
  for (const tab of ["overview", "review"] as const) {
    const html = renderToStaticMarkup(createElement(CaseWorkspace, { c, role: "commission", tab, onBack() {}, onTab() {}, onAction() {}, onDocument() {}, onUpload() {} }));
    assert.doesNotMatch(html, /Язык обращения/);
    assert.ok(html.includes(c.id));
  }
});
