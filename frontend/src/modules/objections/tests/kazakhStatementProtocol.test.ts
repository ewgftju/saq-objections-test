import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { addDocument } from "../services/workflow";
import { DocumentContent } from "../components/DocumentModal";

for (const language of ["ru", "kk"] as const) test(`казахский протокол заявления с исходным языком ${language}`, () => {
  const state = initialState(), c = state.cases[0];
  c.appealType = "Заявление"; c.appealLanguage = language; c.applicantIdentifierType = "ИИН"; c.bin = "001002003004";
  c.org = language === "kk" ? "Азамат" : "Заявитель"; c.orgTranslations = { kk: "Азамат" };
  c.documentApplicantNames = { protocol: { kk: "Азаматтың" } }; c.appealDate = "2026-09-08"; c.appealNumber = "1-З";
  c.request = language === "kk" ? "Мектеп құрылысы туралы" : "О строительстве школы";
  c.statementTranslations = language === "ru" ? { kk: "Мектеп құрылысы туралы" } : {};
  c.documents = []; addDocument(c, "work", state.date, "Протокол", "protocol", "");
  const document = c.documents.at(-1)!;
  document.languages = ["kk"]; document.snapshot!.request = c.request; document.snapshot!.statementTranslations = c.statementTranslations;
  const render = () => renderToStaticMarkup(createElement(DocumentContent, { c, kind: "protocol", document, language: "kk" }));
  const expected = "Азаматтың, ЖСН 001002003004, 2026 жылғы 08 қыркүйектегі № 1-З Мектеп құрылысы туралы өтініші.";
  assert.ok(render().includes(expected));
  c.statementTranslations = { kk: "Басқа мәтін" }; c.request = "Другая тема"; c.documentApplicantNames = { protocol: { kk: "Басқа" } };
  assert.ok(render().includes(expected));
});
