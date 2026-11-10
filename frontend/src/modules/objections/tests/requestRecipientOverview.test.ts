import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import CaseWorkspace from "../pages/CaseWorkspace";
import { isAuditAuthorityForCase } from "../services/statusPresentation";
import type { Role } from "../../../types";

test("карточка обращения доступна органу аудита, но не дополнительному адресату SAQ", () => {
  const c = initialState().cases[0];
  c.issuer = "ДВГА по г. Алматы";
  c.requests = [{ id: "q1", recipient: "Кабинет КВГА SAQ", date: "2026-09-08", sent: "2026-09-08", deadline: "2026-09-10", template: "other", saqRecipient: "kvga", text: "Дополнительный запрос" }];
  const render = (role: Role) => renderToStaticMarkup(createElement(CaseWorkspace, { c, tab: "overview", role, onBack() {}, onTab() {}, onAction() {}, onDocument() {}, onUpload() {} }));
  assert.equal(isAuditAuthorityForCase(c, "dvga"), true);
  assert.equal(isAuditAuthorityForCase(c, "kvga"), false);
  assert.match(render("dvga"), />Обращение<\/button>/);
  const html = render("kvga");
  assert.doesNotMatch(html, />Обращение<\/button>/);
  assert.match(html, /Материалы и результаты/);
  assert.doesNotMatch(html, /Наименование объекта заявителя/);
  assert.doesNotMatch(render("subject"), />Обращение<\/button>/);
});

test("комитет видит карточку, когда является органом аудита", () => {
  const c = initialState().cases[0];
  c.issuer = "КВГА";
  assert.equal(isAuditAuthorityForCase(c, "kvga"), true);
  assert.equal(isAuditAuthorityForCase(c, "dvga"), false);
});
