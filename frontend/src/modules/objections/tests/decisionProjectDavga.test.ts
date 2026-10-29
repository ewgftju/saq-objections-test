import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { addDocument } from "../services/workflow";
import { DocumentContent } from "../components/DocumentModal";

test("приложения используют доводы участника с итоговым голосом из подписанного протокола", () => {
  const c = initialState().cases[0];
  c.appealType = "Жалоба на уведомление";
  const first = c.issues.find((point) => point.disputed)!;
  const second = { ...first, id: "second-project-test", number: "2", disputed: true };
  c.issues = [first, second];
  c.certificate = { davgaArguments: "Справка", memberPositions: [] };
  const vote = (votes: Record<string, string>, chair: string) => ({ yes: 0, no: 0, approved: true, chair, present: 3, eligible: 3, votes });
  c.votes = { [first.id]: vote({ a: "reject", b: "accept", c: "accept" }, "a"), [second.id]: vote({ a: "reject", b: "accept" }, "a") };
  const row = (pointId: string, pointNumber: string | number, memberId: string, choice: string, text: string) => ({ pointId, pointNumber, memberId, memberName: memberId, vote: choice, original: "Доводы рабочего органа (ДАВГА МФ РК): Справка", edited: `Доводы ДВГА: Скрытый текст\n\nДоводы рабочего органа (ДАВГА МФ РК): ${text}` });
  c.meeting = { date: "2026-10-29", number: "1", audio: "", signed: "2026-10-29", protocolVersions: [{ createdAt: "2026-10-29T10:00:00Z", signedAt: "2026-10-29T11:00:00Z", author: "Исполнитель", rows: [row(first.id, first.number, "a", "reject", "Проигравший"), row(first.id, first.number, "b", "accept", "Выигравший 1\nВторая строка"), row(first.id, first.number, "c", "accept", "Другой выигравший"), row(second.id, second.number, "a", "reject", "Решающим голосом 2"), row(second.id, second.number, "b", "accept", "Проигравший 2")] }] };
  for (const kind of ["decision-project", "final-response"] as const) {
    const html = renderToStaticMarkup(createElement(DocumentContent, { c, kind }));
    assert.match(html, /Выигравший 1\nВторая строка/);
    assert.match(html, /Решающим голосом 2/);
    assert.doesNotMatch(html, /Проигравший|Другой выигравший|Скрытый текст|Справка/);
  }
  addDocument(c, "work", "2026-10-29", "Проект решения", "decision-project", "");
  const document = c.documents.at(-1)!;
  c.meeting.protocolVersions![0].rows[1].edited = "Доводы рабочего органа (ДАВГА МФ РК): Поздняя правка";
  const saved = renderToStaticMarkup(createElement(DocumentContent, { c, kind: "decision-project", document }));
  assert.match(saved, /Выигравший 1/);
  assert.doesNotMatch(saved, /Поздняя правка/);
});
