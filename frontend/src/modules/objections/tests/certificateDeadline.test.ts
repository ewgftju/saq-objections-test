import assert from "node:assert/strict";
import test from "node:test";
import { initialState } from "../../../api/objectionsRepository";
import type { Action } from "../../../types";
import { executionDeadline, reviewDeadline } from "../services/deadlines";
import { applyAction } from "../services/workflow";

const sentRequest = {
  date: "2026-09-08",
  sent: "2026-09-08",
  text: "",
  deadline: "",
};

test("справка: пять рабочих дней от последнего ответа первоначального маршрута", () => {
  let state = initialState();
  const c = state.cases[0];
  c.appealType = "Возражение на уведомление";
  c.document.received = sentRequest.date;
  c.status = "request_approved";
  c.requestPauseStartedAt = sentRequest.date;
  c.requests = [
    {
      ...sentRequest,
      id: "external",
      recipient: "Другой орган",
      template: "other",
      route: "initial",
    },
    {
      ...sentRequest,
      id: "authority",
      recipient: "ДВГА",
      template: "dvga",
      responseSigned: "2026-09-11",
    },
  ];

  const run = (action: Action, values: Record<string, string>) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    state = applyAction(state, c.id, action, "work", form);
    return state.cases[0];
  };

  const analysis = run("record-external-response", {
    externalRequestId: "external",
    date: "2026-09-14",
    responseRegistrationNumber: "ВХ-1",
  });
  assert.equal(analysis.status, "materials");
  assert.equal(executionDeadline(analysis), "2026-09-21");
  assert.equal(analysis.pauseDays, 4);
  assert.equal(reviewDeadline(analysis), "2026-10-05");

  run("start-analysis-additional-request", {
    date: "2026-09-16",
    reason: "Нужны пояснения",
  });
  const additional = run("request-other", {
    date: "2026-09-16",
    recipient: "Другой орган",
    registrationNumber: "ИСХ-2",
  });
  const returned = run("record-external-response", {
    externalRequestId: additional.requests.at(-1)!.id,
    date: "2026-09-23",
    responseRegistrationNumber: "ВХ-2",
  });
  assert.equal(returned.status, "materials");
  assert.equal(executionDeadline(returned), "2026-09-21");
});

test("справка: дата подписания ответа в SAQ учитывается отдельно от даты фиксации", () => {
  const c = initialState().cases[0];
  c.status = "materials";
  c.requests = [
    {
      ...sentRequest,
      id: "authority",
      recipient: "ДВГА",
      template: "dvga",
      responded: "2026-09-09",
      responseSigned: "2026-09-11",
      confirmed: "2026-09-15",
    },
    {
      ...sentRequest,
      id: "external",
      recipient: "Другой орган",
      template: "other",
      responded: "2026-09-10",
      confirmed: "2026-09-15",
    },
    {
      ...sentRequest,
      id: "cancelled",
      recipient: "Другой орган",
      template: "other",
      responded: "2026-09-14",
      cancelled: "2026-09-15",
    },
  ];
  assert.equal(executionDeadline(c), "2026-09-18");
});
