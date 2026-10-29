import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProtocolVersion } from "../../../types";
import { ProtocolVersions } from "../components/ProtocolVersions";

test("таблица показывает последнюю версию первой и фактические статусы", () => {
  const rows = [{ pointId: "1", pointNumber: "5", memberId: "a", memberName: "Алиева", vote: "accept", original: "111", edited: "11" }];
  const versions: ProtocolVersion[] = [
    { author: "Исполнитель", createdAt: "2026-10-27T10:00:00Z", rows, returnedAt: "2026-10-27T11:00:00Z", returnComment: "Исправить" },
    { author: "Исполнитель", createdAt: "2026-10-28T10:00:00Z", rows },
  ];
  const html = renderToStaticMarkup(createElement(ProtocolVersions, { versions, status: "protocol" }));
  assert.ok(html.indexOf("Версия 2") < html.indexOf("Версия 1"));
  assert.match(html, /На подписании/);
  assert.match(html, /Возвращена на доработку/);
  assert.match(html, /Пункт № 5 · обоснований: 1/);
  assert.equal((html.match(/aria-expanded="false"/g) || []).length, 2);
  assert.doesNotMatch(html, /Исправить/);
});
