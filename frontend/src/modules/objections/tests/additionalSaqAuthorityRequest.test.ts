import test from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../../../api/objectionsRepository";
import { actionForm } from "../formDefinitions";
import { additionalActions, applyAction, nextAction } from "../services/workflow";
import { isRequestForAuthority } from "../services/statusPresentation";

for (const role of ["dvga", "kvga"] as const) test(`дополнительный запрос и отдельный ответ: ${role}`, () => {
  let state = initialState();
  const c = state.cases[0];
  c.status = "accepted";
  c.requests = [{ id: "original", recipient: "ДВГА по г. Алматы", date: state.date, deadline: state.date, text: "Первоначальный", template: "dvga", sent: state.date, responded: state.date, responseApproved: state.date, responseSigned: state.date, lifecycleStatus: "response_received" }];
  const run = (action: Parameters<typeof applyAction>[2], actor: Parameters<typeof applyAction>[3], fields: Record<string, string> = {}) => {
    const form = new FormData(); for (const [key, value] of Object.entries(fields)) form.set(key, value);
    state = applyAction(state, c.id, action, actor, form);
  };
  const options = actionForm("request-saq", c, state.date, {}).fields.find(f => f.name === "saqRecipient")?.options;
  assert.ok(options?.some(([value]) => value === role));
  run("request-saq", "work", { saqRecipient: role, customRequestText: "Дополнительные материалы" });
  const id = state.cases[0].requests.at(-1)!.id;
  run("send-request-approval", "work");
  run("approve-request", "deputy", { approved: "on", requestId: id });
  run("sign-request", "director", { requestId: id });
  const afterSign = state.cases[0];
  const request = afterSign.requests.find(r => r.id === id)!;
  assert.equal(isRequestForAuthority(request, role), true);
  assert.equal(nextAction(afterSign, role)?.action, "subject-response");
  assert.ok(additionalActions(afterSign).some(a => a.action === "subject-response" && a.role === role));
  assert.throws(() => applyAction(state, c.id, "subject-response", role === "dvga" ? "kvga" : "dvga", new FormData()));
  run("subject-response", role);
  assert.ok(state.cases[0].requests.find(r => r.id === id)?.responded);
  assert.equal(state.cases[0].requests[0].responseSigned, state.date);
  assert.equal(state.cases[0].status, "materials");
});
