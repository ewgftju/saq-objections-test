import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import AgendaModal, { AgendaDocument, agendaDocumentHtml } from "../components/AgendaModal";

test("повестка содержит русский и казахский разделы в одном порядке", () => {
  const state = initialState();
  const first = structuredClone(state.cases[0]);
  first.id = "В-1"; first.appealNumber = "В-1"; first.appealType = "Возражение на аудиторский отчет"; first.issuer = "ДВГА по Атырауской области";
  const second = structuredClone(first);
  second.id = "З-2"; second.appealNumber = "З-2"; second.appealType = "Заявление"; second.appealLanguage = "ru"; second.request = "О пересмотре"; second.statementTranslations = { kk: "Қайта қарау туралы" };
  const html = agendaDocumentHtml([first, second], state.date);
  assert.match(html, /lang="ru"/); assert.match(html, /lang="kk"/);
  assert.match(html, /Перечень материалов к рассмотрению/);
  assert.match(html, /қарастырылатын материалдар тізімі/);
  assert.match(html, /Атырау облысы бойынша Ішкі мемлекеттік аудит департаменті/);
  assert.ok(html.includes("О пересмотре")); assert.ok(html.includes("Қайта қарау туралы"));
  const pages = html.split('<article class="print-document agenda-template"');
  assert.equal(pages.length, 3);
  for (const page of pages.slice(1)) assert.ok(page.indexOf("В-1") < page.indexOf("З-2"));
  assert.match(html, /page-break-before: always/);
  const modal = renderToStaticMarkup(createElement(AgendaModal, { cases: [first, second], date: state.date, onSend() {}, onClose() {} }));
  assert.match(modal, /Язык повестки дня/); assert.match(modal, /Қазақша/);
});

test("доступные переводы предмета закупки используются без изменения оригинала", () => {
  const c = initialState().cases[0];
  c.appealType = "Жалоба на действие/бездействие"; c.appealLanguage = "ru";
  c.agendaDetails = { procurementNumber: "123", procurementSubject: "Поставка", procurementSubjectTranslations: { kk: "Жеткізу" } };
  const kk = renderToStaticMarkup(createElement(AgendaDocument, { cases: [c], meetingDate: "2026-09-08", language: "kk" }));
  assert.match(kk, /Жеткізу/);
  assert.equal(c.agendaDetails.procurementSubject, "Поставка");
});
