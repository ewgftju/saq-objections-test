import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { DocumentContent } from "../components/DocumentModal";
import { agendaItemText } from "../components/AgendaModal";

test("дата и номер предписания берутся из реквизитов предписания, а не отчёта", () => {
  const c = initialState().cases[0];
  c.appealType = "Жалоба на решение КВГА/ДВГА"; c.appealLanguage = "ru";
  c.document = { ...c.document, number: "ПР-25", date: "2026-09-03" };
  c.agendaDetails = { ...c.agendaDetails, decisionKind: "prescription-audit", relatedDocumentNumber: "АО-10", relatedDocumentDate: "2026-09-01" };
  const expected = /на предписание от 03\.09\.2026 года № ПР-25/;
  assert.match(agendaItemText(c), expected);
  for (const kind of ["certificate", "protocol"]) {
    const html = renderToStaticMarkup(createElement(DocumentContent, { c, kind, language: "ru", languages: ["ru"] }));
    assert.match(html, expected); assert.doesNotMatch(html, /на предписание от 01\.09\.2026 года № АО-10/);
  }
});
