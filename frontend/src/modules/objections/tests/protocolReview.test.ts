import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { applyAction, nextAction } from "../services/workflow";
import { certificateBasisForPoint } from "../services/protocolReason";
import { DocumentContent } from "../components/DocumentModal";
import { ProtocolChanges } from "../components/ProtocolChanges";

test("изменения обоснования сохраняются, доступны директору и переживают возврат", () => {
  let state = initialState();
  const c = state.cases[0];
  c.status = "meeting";
  c.members = [{ id: "chair", name: "Председатель", present: true, recused: false, reason: "" }];
  const points = c.issues.filter((point) => point.disputed);
  const first = points[0];
  const original = certificateBasisForPoint(c, first);
  const form = (edit: string) => {
    const data = new FormData();
    data.set("protocolDate", "2026-09-10");
    for (const point of points) {
      data.set(`protocolVote_${point.id}_chair`, "accept");
      data.set(`protocolReason_${point.id}_chair`, point.id === first.id ? edit : certificateBasisForPoint(c, point));
    }
    return data;
  };
  state = applyAction(state, c.id, "vote", "work", form(original + " исправлено"));
  let saved = state.cases.find((item) => item.id === c.id)!;
  assert.equal(nextAction(saved, "commission")?.role, "commission");
  assert.equal(saved.meeting?.protocolVersions?.[0].rows[0].original, original);
  const comparison = renderToStaticMarkup(createElement(ProtocolChanges, { version: saved.meeting!.protocolVersions![0] }));
  assert.match(comparison, /Изменены обоснования: 1/);
  assert.match(comparison, /<mark/);
  assert.match(saved.history.at(-2)?.title || "", /Изменены обоснования/);
  const returnForm = new FormData(); returnForm.set("returnComment", "Уточнить текст");
  state = applyAction(state, c.id, "return-protocol", "director", returnForm);
  saved = state.cases.find((item) => item.id === c.id)!;
  assert.equal(saved.status, "meeting");
  assert.equal(saved.meeting?.protocolVersions?.[0].returnComment, "Уточнить текст");
  state = applyAction(state, c.id, "vote", "work", form(original));
  saved = state.cases.find((item) => item.id === c.id)!;
  assert.equal(saved.meeting?.protocolVersions?.length, 2);
  assert.equal(saved.meeting?.protocolVersions?.[1].rows[0].edited, original);
  assert.equal(saved.history.filter((event) => event.title === "Изменены обоснования протокола").length, 2);
  // Ранее дело могло остаться на ожидании подписи директора.
  saved.meeting!.commissionSigned = state.date;
  assert.equal(nextAction(saved, "commission")?.role, "commission");
  const commissionSign = new FormData(); commissionSign.set("signed_chair", "on"); commissionSign.set("reason", "Итог");
  state = applyAction(state, c.id, "sign", "commission", commissionSign);
  saved = state.cases.find((item) => item.id === c.id)!;
  assert.ok(saved.meeting?.protocolVersions?.[1].signedAt);
  assert.notEqual(saved.status, "protocol");
  const html = renderToStaticMarkup(createElement(DocumentContent, { c: saved, kind: "protocol" }));
  assert.doesNotMatch(html, /Изменены обоснования|Посмотреть изменения/);
});
