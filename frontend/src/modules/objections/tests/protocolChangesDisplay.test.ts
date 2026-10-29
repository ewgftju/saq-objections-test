import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProtocolVersion } from "../../../types";
import { ProtocolChanges } from "../components/ProtocolChanges";

test("сравнение группирует одинаковые изменения по пункту и сохраняет доступ к старым правкам", () => {
  const original = "Доводы ДВГА: СТАРЫЙ ТЕКСТ\n\nДоводы рабочего органа (ДАВГА МФ РК): Позиция";
  const edited = "Доводы ДВГА: СТАРЫЙ ТЕКСТ\n\nДоводы рабочего органа (ДАВГА МФ РК): Позиция дополнена";
  const version: ProtocolVersion = { author: "Исполнитель", createdAt: "2026-10-29T10:00:00Z", rows: [
    { pointId: "1", pointNumber: "1", memberId: "a", memberName: "Алиева", vote: "accept", original, edited },
    { pointId: "1", pointNumber: "1", memberId: "b", memberName: "Кенбеил", vote: "reject", original, edited },
    { pointId: "1", pointNumber: "1", memberId: "c", memberName: "Другой", vote: "accept", original, edited: original },
    { pointId: "2", pointNumber: "2", memberId: "a", memberName: "Алиева", vote: "accept", original, edited: edited.replace("СТАРЫЙ ТЕКСТ", "НОВЫЙ ТЕКСТ") },
  ] };
  const html = renderToStaticMarkup(createElement(ProtocolChanges, { version }));
  assert.equal((html.match(/Доводы ДАВГА из справки/g) || []).length, 2);
  const firstPoint = html.split("Пункт № 2")[0];
  assert.equal((firstPoint.match(/дополнена/g) || []).length, 1);
  assert.match(html, /Алиева/); assert.match(html, /Кенбеил/);
  assert.doesNotMatch(html, /Другой/);
  assert.equal((html.match(/Другие изменения — полное сравнение/g) || []).length, 1);
  assert.match(html, /НОВЫЙ ТЕКСТ/);
});
