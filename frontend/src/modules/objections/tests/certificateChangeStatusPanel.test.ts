import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import ConsiderationProcess from "../components/ConsiderationProcess";

test("информационный блок показывает статус и решения директора и недоступен внешним ролям", () => {
  const c = initialState().cases[0];
  c.status = "meeting";
  c.certificate = { davgaArguments: "", memberPositions: [] };
  c.certificateChangeRequests = [
    {
      stage: "protocol",
      status: "pending",
      proposedAt: "2026-10-29T10:00:00Z",
      proposedBy: "Исполнитель",
      changes: [
        {
          pointId: "p1",
          pointNumber: "1",
          language: "ru",
          before: "Старый",
          proposed: "Новый",
        },
        {
          pointId: "p2",
          pointNumber: "2",
          language: "kk",
          before: "Бұрын",
          proposed: "Кейін",
        },
      ],
    },
  ];
  const request = c.certificateChangeRequests[0];
  const render = (
    role: "work" | "director" | "commission" | "subject" | "dvga",
  ) =>
    renderToStaticMarkup(
      createElement(ConsiderationProcess, {
        c,
        role,
        onAction() {},
        onHistory() {},
      }),
    );
  for (const role of ["work", "director"] as const) {
    const html = render(role);
    assert.match(html, /Изменение доводов ДАВГА/);
    assert.match(html, /Ожидает решения директора/);
    assert.match(html, /Этап: Формирование протокола/);
    assert.match(html, /Исполнитель/);
  }
  assert.match(render("director"), />Рассмотреть<\/button>/);
  assert.doesNotMatch(render("work"), />Рассмотреть<\/button>/);
  for (const role of ["commission", "subject", "dvga"] as const)
    assert.doesNotMatch(render(role), /Последнее предложение/);
  request.status = "reviewed";
  request.reviewedAt = "2026-10-29T11:00:00Z";
  request.reviewComment = "Проверено";
  request.changes[0].decision = "accepted";
  request.changes[1].decision = "rejected";
  let html = render("work");
  assert.match(html, /Частично принято/);
  assert.match(html, /Пункт № 1 · Русский: принято/);
  assert.match(html, /Пункт № 2 · Қазақша: отклонено/);
  assert.match(html, /Комментарий директора: Проверено/);
  request.changes[1].decision = "accepted";
  assert.match(render("work"), />Принято<\/span>/);
  request.changes[0].decision = "rejected";
  request.changes[1].decision = "rejected";
  assert.match(render("work"), />Отклонено<\/span>/);
  request.status = "withdrawn";
  request.withdrawnAt = "2026-10-29T12:00:00Z";
  html = render("director");
  assert.match(html, />Отозвано<\/span>/);
  assert.match(html, /Справка не изменена/);
  assert.doesNotMatch(html, />Рассмотреть<\/button>/);
});
