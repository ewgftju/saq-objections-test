import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { DocumentContent } from "../components/DocumentModal";

test("печатная форма протокола сохраняет переносы строк в обосновании", () => {
  const c = initialState().cases[0];
  const point = c.issues.find((issue) => issue.disputed)!;
  const member = c.members[0];
  const reason = "Доводы ДВГА: первый текст\n\nДоводы заявителя: второй текст\n\nДоводы ДАВГА: третий текст";
  const html = renderToStaticMarkup(createElement(DocumentContent, {
    c,
    kind: "protocol",
    protocolPreview: {
      date: "2026-10-28", number: "1", audio: "", members: [member],
      votes: {}, voteReasons: { [point.id]: { [member.id]: reason } },
    },
  }));
  assert.ok(html.includes(`<td style="white-space:pre-wrap">${reason}</td>`));
});
