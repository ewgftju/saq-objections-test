import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import CaseWorkspace from "../pages/CaseWorkspace";
import ActionModal from "../components/ActionModal";

test("язык обращения виден в шапке и в формах приложений", () => {
  const state = initialState();
  const c = state.cases[0];
  c.appealType = "Жалоба на уведомление";
  for (const [language, label] of [["ru", "русский"], ["kk", "казахский"], [undefined, "не указан"]] as const) {
    c.appealLanguage = language;
    const workspace = renderToStaticMarkup(createElement(CaseWorkspace, { c, role: "work", tab: "review", onBack() {}, onTab() {}, onAction() {}, onDocument() {}, onUpload() {} }));
    assert.ok(workspace.includes(`Язык обращения: ${label}`));
    for (const action of ["create-decision-project", "deliver"] as const) {
      const form = renderToStaticMarkup(createElement(ActionModal, { c, action, date: state.date, role: "work", onSubmit() {}, onClose() {} }));
      assert.match(form, new RegExp(`Язык приложения: <b>${language === "kk" ? "казахский" : "русский"}</b>`));
      assert.ok(form.includes(language ? "в соответствии с языком обращения" : "язык обращения не указан, используется русский по умолчанию"));
      assert.ok(form.includes("Основная часть документа формируется на казахском языке"));
    }
  }
});
