import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import AgendaModal, { AgendaDocument, agendaDocumentHtml } from "../components/AgendaModal";

test("повестка формируется на казахском и русском языках в одинаковом порядке", () => {
  const state = initialState();
  const first = structuredClone(state.cases[0]);
  first.id = "В-1"; first.appealNumber = "В-1"; first.appealType = "Возражение на аудиторский отчет"; first.issuer = "ДВГА по Атырауской области";
  first.assignee = "Исполнитель рабочего органа";
  const second = structuredClone(first);
  second.id = "З-2"; second.appealNumber = "З-2"; second.appealType = "Заявление"; second.appealLanguage = "ru"; second.request = "О пересмотре"; second.statementTranslations = { kk: "Қайта қарау туралы" };
  second.assignee = "Әбілова Әлия";
  const third = { ...second, id: "З-3", appealNumber: "З-3", assignee: "Не назначен" };
  const html = agendaDocumentHtml([first, second, third], state.date);
  assert.match(html, /lang="ru"/); assert.match(html, /lang="kk"/);
  assert.match(html, /Перечень материалов к рассмотрению/);
  assert.match(html, /қаралатын материалдар тізімі/);
  assert.ok(html.includes("О пересмотре")); assert.ok(html.includes("Қайта қарау туралы"));
  const pages = html.split('<article class="print-document agenda-template');
  assert.equal(pages.length, 3);
  assert.match(pages[1], /lang="kk"/);
  assert.match(pages[2], /lang="ru"/);
  assert.match(pages[2], /page-break-before:always/);
  for (const page of pages.slice(1)) {
    const items = Array.from(page.matchAll(/<li>(.*?)<\/li>/gu), (match) => match[1]);
    assert.equal(items.length, 3);
    assert.match(items[0], /В-1.*\. \(Жукенов К\.\)$/u);
    assert.match(items[1], /З-2.*\. \(Әбілова Ә\.\)$/u);
    assert.match(items[2], /З-3/u);
    assert.doesNotMatch(items[2], /\([^()]*\)$/u);
  }
  const modal = renderToStaticMarkup(createElement(AgendaModal, { cases: [first, second], date: state.date, onSend() {}, onClose() {} }));
  assert.doesNotMatch(modal, /Язык повестки дня/);
});

test("доступные переводы предмета закупки используются без изменения оригинала", () => {
  const c = initialState().cases[0];
  c.appealType = "Жалоба на действие/бездействие"; c.appealLanguage = "kk";
  c.agendaDetails = { procurementNumber: "123", procurementSubject: "Жеткізу", procurementSubjectTranslations: { ru: "Поставка" } };
  const ru = renderToStaticMarkup(createElement(AgendaDocument, { cases: [c], meetingDate: "2026-09-08" }));
  assert.match(ru, /Поставка/);
  assert.equal(c.agendaDetails.procurementSubject, "Жеткізу");
});
