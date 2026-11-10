import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { DocumentContent } from "../components/DocumentModal";
import { addDocument } from "../services/workflow";

test("справка показывает заполненные ответы без пустых повторов от других запросов", () => {
  const c = initialState().cases[0];
  c.appealLanguage = "ru"; c.appealType = "Возражение на аудиторский отчет";
  c.issues = [{ ...c.issues[0], id: "p1", number: "4", disputed: true, authorityFinding: "", position: "" }];
  c.requests = [
    { id: "main", recipient: "ДВГА по Атырауской области", date: "2026-09-08", deadline: "2026-09-10", text: "", template: "dvga", authorityResponses: { p1: { finding: "Нарушение по пункту", response: "Ответ органа" } } },
    { id: "empty", recipient: "ДВГА по Атырауской области", date: "2026-09-08", deadline: "2026-09-10", text: "", template: "dvga", authorityResponses: { p1: { finding: "—", response: "" } } },
    { id: "free", recipient: "Кабинет ДВГА SAQ", date: "2026-09-08", deadline: "2026-09-10", text: "", template: "other", saqRecipient: "dvga" },
  ];
  c.documents = [];
  c.certificate = { languages: ["ru"], davgaArguments: "Позиция рабочего органа", memberPositions: [] };
  addDocument(c, "work", "2026-09-08", "Справка", "certificate", "");
  const document = c.documents.at(-1)!;
  const html = renderToStaticMarkup(createElement(DocumentContent, { c, document, kind: "certificate", language: "ru" }));
  assert.match(html, /Нарушение по пункту/);
  assert.match(html, /Ответ органа/);
  assert.equal((html.match(/Доводы ДВГА:<\/b>/g) || []).length, 1);
  assert.equal((html.match(/Мотивированный ответ ДВГА:<\/b>/g) || []).length, 1);
  assert.doesNotMatch(html, /(?:Доводы|Мотивированный ответ) ДВГА:<\/b>\s*—/);
});

test("если ответа органа нет, пустые строки справки не выводятся", () => {
  const c = initialState().cases[0];
  c.appealLanguage = "ru";
  c.issues = [{ ...c.issues[0], id: "p1", disputed: true, authorityFinding: "", position: "" }];
  c.requests = [{ id: "free", recipient: "Кабинет ДВГА SAQ", date: "2026-09-08", deadline: "2026-09-10", text: "", template: "other", saqRecipient: "dvga" }];
  c.certificate = { languages: ["ru"], davgaArguments: "Позиция рабочего органа", memberPositions: [] };
  const html = renderToStaticMarkup(createElement(DocumentContent, { c, kind: "certificate", language: "ru" }));
  assert.doesNotMatch(html, /Доводы ДВГА:<\/b>/);
  assert.doesNotMatch(html, /Мотивированный ответ ДВГА:<\/b>/);
  assert.match(html, /Позиция рабочего органа/);
});

test("заполненные дополнительные ответы сохраняются в обеих языковых версиях", () => {
  const c = initialState().cases[0];
  c.appealLanguage = "ru";
  c.issues = [{ ...c.issues[0], id: "p1", disputed: true, authorityFinding: "", position: "" }];
  c.requests = [
    { id: "first", recipient: "ДВГА по Атырауской области", date: "2026-09-08", deadline: "2026-09-10", text: "", template: "dvga", authorityResponses: { p1: { finding: "Первое нарушение", response: "Первый ответ" } }, authorityResponsesKk: { p1: { finding: "Бірінші бұзушылық", response: "Бірінші жауап" } } },
    { id: "second", recipient: "ДВГА по Атырауской области", date: "2026-09-08", deadline: "2026-09-10", text: "", template: "dvga", route: "additional-analysis", authorityResponses: { p1: { finding: "Второе нарушение", response: "Второй ответ" } }, authorityResponsesKk: { p1: { finding: "Екінші бұзушылық", response: "Екінші жауап" } } },
  ];
  c.certificate = { languages: ["ru", "kk"], davgaArguments: "", memberPositions: [] };
  for (const [language, text] of [["ru", "Второе нарушение"], ["kk", "Екінші бұзушылық"]] as const) {
    const html = renderToStaticMarkup(createElement(DocumentContent, { c, kind: "certificate", language }));
    assert.match(html, new RegExp(text));
  }
});
