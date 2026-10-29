import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { addDocument } from "../services/workflow";
import CaseWorkspace from "../pages/CaseWorkspace";

test("история версий доступна у протокола рабочему органу и директору", () => {
  const c = initialState().cases[0];
  c.status = "decision_project";
  c.meeting = { date: "2026-10-29", number: "1", audio: "", protocolVersions: [{ createdAt: "2026-10-29", author: "Исполнитель", rows: [] }] };
  addDocument(c, "work", "2026-10-29", "Протокол заседания", "protocol", "");
  const render = (role: "work" | "director" | "dvga") => renderToStaticMarkup(createElement(CaseWorkspace, { c, tab: "review", role, onBack() {}, onTab() {}, onAction() {}, onDocument() {}, onUpload() {} }));
  for (const role of ["work", "director"] as const) {
    const html = render(role);
    assert.match(html, /Протокол заседания/);
    assert.match(html, /История изменений/);
    assert.ok(html.indexOf("Протокол заседания") < html.indexOf("История изменений"));
    assert.doesNotMatch(html, /Версии протокола/);
  }
  assert.doesNotMatch(render("dvga"), /История изменений/);
});
