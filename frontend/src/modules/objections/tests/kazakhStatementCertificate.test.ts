import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { addDocument } from "../services/workflow";
import { DocumentContent } from "../components/DocumentModal";

for (const language of ["ru", "kk"] as const) test(`казахская справка заявления использует нужную тему и сохранённые данные: ${language}`, () => {
  const state = initialState(), c = state.cases[0];
  c.appealType = "Заявление"; c.appealLanguage = language; c.applicantIdentifierType = "ИИН"; c.bin = "001002003004";
  c.org = language === "kk" ? "Азамат" : "Заявитель"; c.orgTranslations = { kk: "Азамат" };
  c.documentApplicantNames = { certificate: { kk: "Азаматтың" } };
  c.appealDate = "2026-09-08"; c.appealNumber = "1-З";
  c.request = language === "kk" ? "Мектеп құрылысы туралы" : "О строительстве школы";
  c.statementTranslations = language === "ru" ? { kk: "Мектеп құрылысы туралы" } : {};
  c.certificate = { languages: ["kk"], davgaArguments: "", davgaArgumentsByPoint: {}, memberPositions: [] };
  c.documents = []; addDocument(c, "work", state.date, "Справка", "certificate", "");
  const document = c.documents.at(-1)!;
  const html = () => renderToStaticMarkup(createElement(DocumentContent, { c, kind: "certificate", document, language: "kk" }));
  const expected = "Қазақстан Республикасы Қаржы министрлігіне Азаматтың, ЖСН 001002003004, 2026 жылғы 08 қыркүйектегі № 1-З Мектеп құрылысы туралы өтініші келіп түсті.";
  assert.ok(html().includes(expected));
  c.request = "Изменённая тема"; c.statementTranslations = { kk: "Өзгертілген тақырып" }; c.documentApplicantNames = { certificate: { kk: "Басқа" } };
  assert.ok(html().includes(expected));
});
