import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import CaseWorkspace from "../pages/CaseWorkspace";

test("языки справок и протокола указываются по каждой сохранённой версии", () => {
  const c = initialState().cases[0];
  c.appealLanguage = "ru";
  c.documents = [
    { kind: "certificate", name: "Справка по результатам изучения и анализа возражения", date: "2026-09-01", author: "Рабочий орган", text: "", languages: ["kk"] },
    { kind: "certificate", name: "Справка: результаты голосования членов АК", date: "2026-09-02", author: "Рабочий орган", text: "", languages: ["ru", "kk"] },
    { kind: "protocol", name: "Подписанный протокол заседания", date: "2026-09-03", author: "АК", text: "", languages: ["ru"] },
  ];
  const html = renderToStaticMarkup(createElement(CaseWorkspace, { c, role: "work", tab: "review", onBack() {}, onTab() {}, onAction() {}, onDocument() {}, onUpload() {} }));
  assert.match(html, /Подписанный протокол заседания<small[^>]*>Язык: русский<\/small>/);
  assert.match(html, /Справка: результаты голосования членов АК<small[^>]*>Язык: русский и казахский<\/small>/);
  assert.match(html, /Справка по результатам изучения и анализа возражения<small[^>]*>Язык: казахский<\/small>/);
});
