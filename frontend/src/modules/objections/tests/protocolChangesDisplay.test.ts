import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProtocolVersion } from "../../../types";
import { ProtocolChanges } from "../components/ProtocolChanges";

test("сравнение показывает полное обоснование и группирует одинаковые изменения", () => {
  const original = "Доводы ДВГА: СТАРЫЙ ТЕКСТ\n\nДоводы рабочего органа (ДАВГА МФ РК): Позиция";
  const edited = "Доводы ДВГА: СТАРЫЙ ТЕКСТ\n\nДоводы рабочего органа (ДАВГА МФ РК): Позиция дополнена";
  const version: ProtocolVersion = { author: "Исполнитель", createdAt: "2026-10-29T10:00:00Z", rows: [
    { pointId: "1", pointNumber: "1", memberId: "a", memberName: "Алиева", vote: "accept", original, edited },
    { pointId: "1", pointNumber: "1", memberId: "b", memberName: "Кенбеил", vote: "reject", original, edited },
    { pointId: "1", pointNumber: "1", memberId: "c", memberName: "Другой", vote: "accept", original, edited: original },
    { pointId: "2", pointNumber: "2", memberId: "a", memberName: "Алиева", vote: "accept", original, edited: edited.replace("СТАРЫЙ ТЕКСТ", "НОВЫЙ ТЕКСТ") },
  ] };
  const html = renderToStaticMarkup(createElement(ProtocolChanges, { version }));
  assert.equal((html.match(/Обоснование протокола/g) || []).length, 2);
  const firstPoint = html.split("Пункт № 2")[0];
  assert.equal((firstPoint.match(/дополнена/g) || []).length, 1);
  assert.match(html, /Алиева/); assert.match(html, /Кенбеил/);
  assert.doesNotMatch(html, /Другой/);
  assert.match(firstPoint, /Доводы ДВГА: СТАРЫЙ ТЕКСТ/);
  assert.match(html, /title="Удалено"/);
  assert.match(html, /title="Добавлено"/);
});

test("повторяющиеся цифры сравниваются посимвольно со справкой", () => {
  const original = "Доводы ДАВГА: 111";
  const edited = "Доводы ДАВГА: 11";
  const version: ProtocolVersion = { author: "Исполнитель", createdAt: "2026-10-29T10:00:00Z", rows: [
    { pointId: "1", pointNumber: "1", memberId: "a", memberName: "Алиева", vote: "accept", original, edited },
  ] };
  const html = renderToStaticMarkup(createElement(ProtocolChanges, { version }));
  assert.match(html, /Доводы ДАВГА: 11<mark title="Удалено"[^>]*>1<\/mark>/);
  assert.doesNotMatch(html, /<mark title="Добавлено"/);
});

test("удалённые и добавленные слова отображаются вместе с полным текстом", () => {
  const original = "Доводы заявителя: текст\n\nДоводы ДАВГА: документы не подтверждают вывод и не учитывают данные";
  const edited = "Доводы заявителя: текст\n\nДоводы ДАВГА: документы частично подтверждают вывод и учитывают данные";
  const version: ProtocolVersion = { author: "Исполнитель", createdAt: "2026-10-29T10:00:00Z", rows: [
    { pointId: "1", pointNumber: "1", memberId: "a", memberName: "Алиева", vote: "accept", original, edited },
  ] };
  const html = renderToStaticMarkup(createElement(ProtocolChanges, { version }));
  assert.match(html, /Доводы заявителя: текст/);
  assert.match(html, /title="Удалено"[^>]*text-decoration:line-through/);
  assert.match(html, /title="Добавлено"/);
  const toPlain = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
  assert.match(toPlain(html.replace(/<mark title="Добавлено"[^>]*>[\s\S]*?<\/mark>/g, "")), /документы не подтверждают вывод и не учитывают данные/);
  assert.match(toPlain(html.replace(/<mark title="Удалено"[^>]*>[\s\S]*?<\/mark>/g, "")), /документы частично подтверждают вывод и учитывают данные/);
  assert.equal((html.match(/title="Удалено"/g) || []).length, 2);
});
