import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import CaseWorkspace from "../pages/CaseWorkspace";

test("рабочий орган и члены АК видят запросы на этапе ознакомления и голосования", () => {
  const c = initialState().cases[0];
  c.requests = [{id: "dvga", recipient: "ДВГА по г. Алматы", date: "2026-09-08", sent: "2026-09-08", responded: "2026-09-08", text: "", deadline: "", template: "dvga"}];
  c.documents = [{name: "Запрос в ДВГА по г. Алматы", kind: "request", text: "", author: "Рабочий орган", date: "2026-09-08", requestId: "dvga"}, {name: "Приложение к запросу", kind: "request-appendix", text: "", author: "Рабочий орган", date: "2026-09-08", requestId: "dvga"}];
  for (const status of ["documents_review", "commission_members", "commission_voting"] as const) {
    c.status = status;
    for (const role of ["work", "commission"] as const) for (const tab of ["review", "documents"] as const) {
      const html = renderToStaticMarkup(createElement(CaseWorkspace, { c, role, tab, onBack() {}, onTab() {}, onAction() {}, onDocument() {}, onUpload() {} }));
      assert.match(html, /Запрос в ДВГА по г\. Алматы/, `${role}, ${status}, ${tab}`);
      assert.match(html, /Приложение к запросу/, `${role}, ${status}, ${tab}`);
    }
  }
});
