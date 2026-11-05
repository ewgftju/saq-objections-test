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
