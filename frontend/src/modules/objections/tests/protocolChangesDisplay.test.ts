import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProtocolVersion } from "../../../types";
import { ProtocolChanges } from "../components/ProtocolChanges";

test("история протокола показывает изменённые и совпадающие со справкой доводы на обоих языках", () => {
  const version: ProtocolVersion = { author: "Исполнитель", createdAt: "2026-11-11T10:00:00Z", languages: ["ru", "kk"], rows: [
    { pointId: "1", pointNumber: "1", memberId: "a", memberName: "Алиева", vote: "accept", original: "Доводы ДАВГА: Русский довод", edited: "Доводы ДАВГА: Русский довод", originalKk: "Жұмыс органының (ҚР ҚМ ІМАЖАД) дәлелдері: Қазақша дәлел", editedKk: "Жұмыс органының (ҚР ҚМ ІМАЖАД) дәлелдері: Өзгерген дәлел" },
    { pointId: "2", pointNumber: "2", memberId: "b", memberName: "Кенбеил", vote: "reject", original: "Доводы ДАВГА: Второй довод", edited: "Доводы ДАВГА: Второй довод", originalKk: "Жұмыс органының (ҚР ҚМ ІМАЖАД) дәлелдері: Екінші дәлел", editedKk: "Жұмыс органының (ҚР ҚМ ІМАЖАД) дәлелдері: Екінші дәлел" },
  ] };
  const html = renderToStaticMarkup(createElement(ProtocolChanges, { version, expanded: true }));
  assert.match(html, /Пункт № 1 · Русский/); assert.match(html, /Пункт № 1 · Қазақша/);
  assert.match(html, /Пункт № 2 · Русский/); assert.match(html, /Пункт № 2 · Қазақша/);
  assert.match(html, /Алиева/); assert.match(html, /Кенбеил/);
  assert.equal((html.match(/Без изменений · Соответствует справке/g) || []).length, 3);
  assert.match(html, /Изменено: 1/); assert.match(html, /title="Добавлено"/);
});

test("история показывает доводы даже когда все они соответствуют справке", () => {
  const version: ProtocolVersion = { author: "Исполнитель", createdAt: "2026-11-11", languages: ["ru"], rows: [
    { pointId: "1", pointNumber: "1", memberId: "a", memberName: "Алиева", vote: "accept", original: "Доводы ДАВГА: Текст справки", edited: "Доводы ДАВГА: Текст справки" },
  ] };
  const html = renderToStaticMarkup(createElement(ProtocolChanges, { version, expanded: true }));
  assert.match(html, /Текст справки/); assert.match(html, /Без изменений · Соответствует справке/);
  assert.match(html, /Изменено: 0/); assert.doesNotMatch(html, /title="Добавлено"/);
});

test("сравнение показывает только доводы ДАВГА и группирует одинаковые изменения", () => {
  const original = "Доводы ДВГА: СТАРЫЙ ТЕКСТ\n\nДоводы рабочего органа (ДАВГА МФ РК): Позиция";
  const edited = "Доводы ДВГА: СТАРЫЙ ТЕКСТ\n\nДоводы рабочего органа (ДАВГА МФ РК): Позиция дополнена";
  const version: ProtocolVersion = { author: "Исполнитель", createdAt: "2026-10-29T10:00:00Z", rows: [
    { pointId: "1", pointNumber: "1", memberId: "a", memberName: "Алиева", vote: "accept", original, edited },
    { pointId: "1", pointNumber: "1", memberId: "b", memberName: "Кенбеил", vote: "reject", original, edited },
    { pointId: "1", pointNumber: "1", memberId: "c", memberName: "Другой", vote: "accept", original, edited: original },
    { pointId: "2", pointNumber: "2", memberId: "a", memberName: "Алиева", vote: "accept", original, edited: edited.replace("СТАРЫЙ ТЕКСТ", "НОВЫЙ ТЕКСТ") },
    { pointId: "3", pointNumber: "3", memberId: "d", memberName: "Без изменений ДАВГА", vote: "accept", original, edited: original.replace("СТАРЫЙ ТЕКСТ", "НОВЫЙ ТЕКСТ") },
  ] };
  const html = renderToStaticMarkup(createElement(ProtocolChanges, { version }));
  assert.equal((html.match(/Доводы ДАВГА из справки/g) || []).length, 2);
  assert.equal((html.match(/Доводы ДАВГА из протокола/g) || []).length, 2);
  const firstPoint = html.split("Пункт № 2")[0];
  assert.equal((firstPoint.match(/дополнена/g) || []).length, 1);
  assert.match(html, /Алиева/); assert.match(html, /Кенбеил/);
  assert.doesNotMatch(html, /Другой/);
  assert.doesNotMatch(html, /Доводы ДВГА|СТАРЫЙ ТЕКСТ|НОВЫЙ ТЕКСТ/);
  assert.doesNotMatch(html, /Без изменений ДАВГА|Пункт № 3|title="Удалено"/);
  assert.match(html, /title="Добавлено"/);
  assert.match(firstPoint, /<td[^>]*>Позиция<\/td><td[^>]*>Позиция<mark title="Добавлено"/);
});

test("повторяющиеся цифры сравниваются посимвольно со справкой", () => {
  const original = "Доводы ДАВГА: 111";
  const edited = "Доводы ДАВГА: 11";
  const version: ProtocolVersion = { author: "Исполнитель", createdAt: "2026-10-29T10:00:00Z", rows: [
    { pointId: "1", pointNumber: "1", memberId: "a", memberName: "Алиева", vote: "accept", original, edited },
  ] };
  const html = renderToStaticMarkup(createElement(ProtocolChanges, { version }));
  assert.match(html, /11<mark title="Удалено"[^>]*>1<\/mark>/);
  assert.doesNotMatch(html, /<mark title="Добавлено"/);
});

test("удалённые и добавленные слова отображаются в доводах ДАВГА", () => {
  const original = "Доводы заявителя: текст\n\nДоводы ДАВГА: документы не подтверждают вывод и не учитывают данные";
  const edited = "Доводы заявителя: текст\n\nДоводы ДАВГА: документы частично подтверждают вывод и учитывают данные";
  const version: ProtocolVersion = { author: "Исполнитель", createdAt: "2026-10-29T10:00:00Z", rows: [
    { pointId: "1", pointNumber: "1", memberId: "a", memberName: "Алиева", vote: "accept", original, edited },
  ] };
  const html = renderToStaticMarkup(createElement(ProtocolChanges, { version }));
  assert.doesNotMatch(html, /Доводы заявителя: текст/);
  assert.match(html, /title="Удалено"[^>]*text-decoration:line-through/);
  assert.match(html, /title="Добавлено"/);
  const toPlain = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
  assert.match(toPlain(html.replace(/<mark title="Добавлено"[^>]*>[\s\S]*?<\/mark>/g, "")), /документы не подтверждают вывод и не учитывают данные/);
  assert.match(toPlain(html.replace(/<mark title="Удалено"[^>]*>[\s\S]*?<\/mark>/g, "")), /документы частично подтверждают вывод и учитывают данные/);
  assert.equal((html.match(/title="Удалено"/g) || []).length, 2);
});
