import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import ActionModal from "../components/ActionModal";
import { DocumentContent } from "../components/DocumentModal";
import { certificateBasisForPoint, protocolDavgaFromReason, replaceProtocolDavga } from "../services/protocolReason";
import { applyAction } from "../services/workflow";

test("в электронной форме меняются только доводы ДАВГА, полное обоснование сохраняется в протоколе", () => {
  let state = initialState();
  const c = state.cases[0];
  c.status = "meeting";
  c.members = [{ id: "chair", name: "Председатель", present: true, recused: false, reason: "" }];
  c.certificate = { davgaArguments: "Исходная позиция ДАВГА", memberPositions: [] };
  const points = c.issues.filter((point) => point.disputed);
  const first = points[0];
  const initial = certificateBasisForPoint(c, first);
  const html = renderToStaticMarkup(createElement(ActionModal, { c, action: "vote", role: "work", date: state.date, onSubmit() {}, onClose() {} }));
  const textarea = html.match(/<textarea[^>]*name="protocolDavga_[^"]*"[^>]*>([\s\S]*?)<\/textarea>/);
  assert.ok(textarea);
  assert.equal(textarea[1], "Исходная позиция ДАВГА");
  assert.doesNotMatch(textarea[1], /Доводы объекта/);
  const form = new FormData();
  form.set("protocolDate", "2026-09-10");
  for (const point of points) {
    form.set(`protocolVote_${point.id}_chair`, "accept");
    form.set(`protocolDavga_${point.id}_chair`, point.id === first.id ? "Новая позиция ДАВГА" : protocolDavgaFromReason(certificateBasisForPoint(c, point)));
    form.set(`protocolReason_${point.id}_chair`, "попытка заменить всё обоснование");
  }
  state = applyAction(state, c.id, "vote", "work", form);
  const saved = state.cases.find((item) => item.id === c.id)!;
  const expected = replaceProtocolDavga(initial, "Новая позиция ДАВГА");
  assert.equal(saved.meeting?.protocolVersions?.at(-1)?.rows[0].edited, expected);
  assert.ok(expected.includes("Доводы объекта государственного аудита"));
  const printed = renderToStaticMarkup(createElement(DocumentContent, { c: saved, kind: "protocol" }));
  assert.ok(printed.includes("Новая позиция ДАВГА"));
  assert.ok(printed.includes("Доводы объекта государственного аудита"));
  assert.doesNotMatch(printed, /попытка заменить всё обоснование/);
});
