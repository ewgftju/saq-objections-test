import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import type { CaseRequest } from "../../../types";
import CaseWorkspace from "../pages/CaseWorkspace";
import CasesList from "../pages/CasesList";
import { executionDeadline } from "../services/deadlines";
import {
  authorityRequestStatusLabel,
  caseStatusLabelForRole,
} from "../services/statusPresentation";

function request(id: string, recipient: string): CaseRequest {
  return {
    id,
    recipient,
    date: "2026-09-08",
    sent: "2026-09-08",
    deadline: "2026-09-10",
    template: "dvga",
    text: "Запрос",
  };
}

test("баннеры комиссии считают голосование, рассмотренные дела и протоколы на подписи", () => {
  const sample = initialState().cases[0];
  const history = [{ date: "2026-09-09", actor: "Рабочий орган", title: "Заседание по данному делу проведено", text: "" }];
  const cases = [
    { ...sample, id: "voting-1", status: "commission_voting" as const, history: [] },
    { ...sample, id: "voting-2", status: "circulated" as const, history: [] },
    { ...sample, id: "signing", status: "protocol" as const, history },
    { ...sample, id: "considered", status: "decided" as const, history },
  ];
  const html = renderToStaticMarkup(createElement(CasesList, {
    cases, date: "2026-09-09", role: "commission", onOpen() {}, onCreate() {}, onExport() {},
  }));
  assert.match(html, /stat-value">2<\/strong><span class="stat-label">Голосование/);
  assert.match(html, /stat-value">2<\/strong><span class="stat-label">Рассмотрено на заседании/);
  assert.match(html, /stat-value">1<\/strong><span class="stat-label">Подписать протокол/);
  assert.ok(html.indexOf('stat-label">Голосование') < html.indexOf('stat-label">Рассмотрено на заседании'));
  assert.ok(html.indexOf('stat-label">Рассмотрено на заседании') < html.indexOf('stat-label">Подписать протокол'));
});

test("КВГА и ДВГА видят статусы только своих запросов независимо от этапа дела", () => {
  const c = initialState().cases[0];
  const dvgaRequest = request("dvga-1", "ДВГА по области");
  const kvgaRequest = request("kvga-1", "КВГА");
  c.requests = [dvgaRequest, kvgaRequest];
  c.status = "materials";

  assert.equal(caseStatusLabelForRole(c, "dvga"), "Подготовка ответа на запрос");
  assert.equal(caseStatusLabelForRole(c, "kvga"), "Подготовка ответа на запрос");
  assert.equal(caseStatusLabelForRole(c, "work"), "Формирование справки");

  dvgaRequest.responded = "2026-09-08";
  assert.equal(authorityRequestStatusLabel(dvgaRequest), "Согласование ответа");
  assert.equal(caseStatusLabelForRole(c, "kvga"), "Подготовка ответа на запрос");

  dvgaRequest.responseApproved = "2026-09-09";
  assert.equal(caseStatusLabelForRole(c, "dvga"), "Подписание ответа");

  dvgaRequest.responseSigned = "2026-09-09";
  c.status = "final_response_approval";
  assert.equal(caseStatusLabelForRole(c, "dvga"), "Ответ направлен");
  assert.equal(executionDeadline(c, "dvga"), null);
  assert.equal(caseStatusLabelForRole(c, "kvga"), "Подготовка ответа на запрос");

  const additional = request("dvga-2", "ДВГА по области");
  additional.sent = "2026-09-11";
  c.requests.push(additional);
  assert.equal(caseStatusLabelForRole(c, "dvga"), "Подготовка ответа на запрос");
  assert.equal(authorityRequestStatusLabel(dvgaRequest), "Ответ направлен");
  assert.equal(executionDeadline(c, "dvga"), "2026-09-15");

  additional.cancelled = "2026-09-12";
  assert.equal(caseStatusLabelForRole(c, "dvga"), "Ответ направлен");

  c.requests = [kvgaRequest];
  c.status = "completed";
  assert.equal(caseStatusLabelForRole(c, "dvga"), undefined);
  assert.equal(executionDeadline(c, "dvga"), null);
});

test("реестр и карточка ДВГА скрывают статусы и блоки рабочего органа", () => {
  const c = initialState().cases[0];
  const ownRequest = request("dvga-1", "ДВГА по области");
  ownRequest.responded = "2026-09-08";
  ownRequest.responseApproved = "2026-09-09";
  c.requests = [ownRequest];
  c.status = "final_response_approval";

  const registry = renderToStaticMarkup(
    createElement(CasesList, {
      cases: [c],
      date: "2026-09-09",
      role: "dvga",
      onOpen() {},
      onCreate() {},
      onExport() {},
    }),
  );
  assert.match(registry, /Подписание ответа/);
  assert.doesNotMatch(registry, /Согласование окончательного ответа/);

  const card = renderToStaticMarkup(
    createElement(CaseWorkspace, {
      c,
      tab: "review",
      role: "dvga",
      onBack() {},
      onTab() {},
      onAction() {},
      onDocument() {},
      onUpload() {},
    }),
  );
  assert.match(card, /Подписание ответа/);
  assert.doesNotMatch(card, /Согласование окончательного ответа/);
  assert.doesNotMatch(card, /Ответственный: Заместитель директора ДАВГА/);
});
