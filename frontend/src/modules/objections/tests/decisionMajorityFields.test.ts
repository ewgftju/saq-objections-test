import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import ActionModal from "../components/ActionModal";
import { applyAction } from "../services/workflow";

test("проект решения и мотивированный ответ не показывают отметки большинства и сохраняют ранее записанные значения", () => {
  for (const action of ["create-decision-project", "deliver"] as const) {
    const state = initialState();
    const c = state.cases[0];
    c.appealType = "Жалоба на уведомление";
    c.status = action === "deliver" ? "decided" : "decision_project";
    const point = c.issues.find((item) => item.disputed)!;
    point.finalDecisionByMajority = true;
    const html = renderToStaticMarkup(createElement(ActionModal, {
      action, c, date: state.date, role: "work", onSubmit() {}, onClose() {},
    }));
    assert.doesNotMatch(html, /name="finalResponseMajority_/);
    assert.doesNotMatch(html, /Решение по оспариваемым пунктам/);
    const updated = applyAction(state, c.id, action, "work", new FormData());
    assert.equal(updated.cases.find((item) => item.id === c.id)?.issues.find((item) => item.id === point.id)?.finalDecisionByMajority, true);
  }
});
