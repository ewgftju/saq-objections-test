import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import ActionModal from "../components/ActionModal";
import { actionForm } from "../formDefinitions";
import { applyAction } from "../services/workflow";

function fixture() {
  const state = initialState();
  const c = state.cases.find((item) => item.type === "audit")!;
  c.status = "request_approved";
  c.appealLanguage = "ru";
  c.issues = [1, 2].map((number) => ({
    id: `p${number}`,
    number: String(number),
    title: `Вопрос ${number}`,
    finding: `Доказательство ${number}.pdf`,
    authorityFinding: `Ответ по другому запросу ${number}`,
    argument: `Довод ${number}`,
    amount: 0,
    disputed: true,
    auditProgramResult: {
      number: String(number),
      name: `Вопрос ${number}`,
      language: "ru" as const,
      answer: `AUDITOR_${number}_RU`,
      translations: { kk: { answer: `AUDITOR_${number}_KK` } },
    },
  }));
  c.requests = ["ДВГА по Атырауской области", "КВГА"].map(
    (recipient, index) => ({
      id: `request-${index}`,
      recipient,
      template: "dvga" as const,
      date: state.date,
      sent: state.date,
      deadline: state.date,
      text: "Запрос",
    }),
  );
  return { state, c };
}

test("КВГА и ДВГА получают ответ аудитора по каждому пункту и языку", () => {
  const { state, c } = fixture();
  for (const role of ["dvga", "kvga"] as const) {
    const fields = actionForm(
      "fill-request-response",
      c,
      state.date,
      {},
      role,
    ).fields;
    for (const number of [1, 2]) {
      assert.equal(
        fields.find((f) => f.name === `authorityFinding_p${number}`)?.value,
        `AUDITOR_${number}_RU`,
      );
      assert.equal(
        fields.find((f) => f.name === `authorityFindingKk_p${number}`)?.value,
        `AUDITOR_${number}_KK`,
      );
      assert.equal(
        fields.find((f) => f.name === `authorityResponse_p${number}`)?.value,
        "",
      );
    }
    const html = renderToStaticMarkup(
      createElement(ActionModal, {
        action: "fill-request-response",
        c,
        date: state.date,
        role,
        onSubmit() {},
        onClose() {},
      }),
    );
    assert.match(
      html,
      /<textarea name="authorityFinding_p1"[^>]*>AUDITOR_1_RU<\/textarea>/,
    );
    assert.match(html, /<td>AUDITOR_1_RU<\/td>/);
    assert.match(html, /<td>AUDITOR_2_RU<\/td>/);
  }
});

test("сохранённые значения и черновик своего запроса имеют приоритет, включая очищенное поле", () => {
  const { state, c } = fixture();
  c.requests[0].authorityResponses = {
    p1: { finding: "Сохранённое нарушение ДВГА", response: "Ответ ДВГА" },
  };
  c.requests[1].authorityResponses = {
    p1: { finding: "Сохранённое нарушение КВГА", response: "Ответ КВГА" },
  };
  c.requests.unshift(
    { ...c.requests[0], id: "unsent", sent: undefined },
    { ...c.requests[0], id: "cancelled", cancelled: state.date },
  );
  assert.equal(
    actionForm("fill-request-response", c, state.date, {}, "kvga").fields.find(
      (f) => f.name === "authorityFinding_p1",
    )?.value,
    "Сохранённое нарушение КВГА",
  );
  c.requests.find((r) => r.id === "request-0")!.responseDraft = {
    savedAt: state.date,
    values: {
      authorityFinding_p1: "",
      authorityFinding_p2: "Черновик нарушения",
    },
  };
  const html = renderToStaticMarkup(
    createElement(ActionModal, {
      action: "fill-request-response",
      c,
      date: state.date,
      role: "dvga",
      onSubmit() {},
      onClose() {},
    }),
  );
  assert.match(html, /<textarea name="authorityFinding_p1"[^>]*><\/textarea>/);
  assert.match(
    html,
    /<textarea name="authorityFinding_p2"[^>]*>Черновик нарушения<\/textarea>/,
  );
  assert.match(html, /<td>Черновик нарушения<\/td>/);
  assert.doesNotMatch(
    html,
    /AUDITOR_1_RU|AUDITOR_2_RU|Сохранённое нарушение ДВГА|Сохранённое нарушение КВГА/,
  );
});

test("отсутствующий ответ или перевод не заменяется доказательствами, названием или другим ответом", () => {
  const { state, c } = fixture();
  c.issues[0].auditProgramResult!.language = "kk";
  c.issues[0].auditProgramResult!.answer = "Жауап аудитордан";
  delete c.issues[0].auditProgramResult!.translations;
  delete c.issues[1].auditProgramResult;
  const fields = actionForm(
    "fill-request-response",
    c,
    state.date,
    {},
    "dvga",
  ).fields;
  assert.equal(fields.find((f) => f.name === "authorityFinding_p1")?.value, "");
  assert.equal(
    fields.find((f) => f.name === "authorityFindingKk_p1")?.value,
    "Жауап аудитордан",
  );
  assert.equal(fields.find((f) => f.name === "authorityFinding_p2")?.value, "");
  assert.equal(
    fields.find((f) => f.name === "authorityFindingKk_p2")?.value,
    "",
  );
});

test("автозаполненные нарушения сохраняются в ответе без изменения исходного ответа аудитора", () => {
  const { state, c } = fixture();
  const sources = structuredClone(c.issues.map((p) => p.auditProgramResult));
  const form = new FormData();
  for (const field of actionForm(
    "fill-request-response",
    c,
    state.date,
    {},
    "dvga",
  ).fields) {
    if (field.type !== "heading")
      form.set(
        field.name,
        field.name.startsWith("authorityResponse")
          ? `Уәжді жауап ${field.name}`
          : field.value || "",
      );
  }
  const saved = applyAction(
    state,
    c.id,
    "fill-request-response",
    "dvga",
    form,
  ).cases.find((item) => item.id === c.id)!;
  for (const number of [1, 2]) {
    assert.equal(
      saved.requests[0].authorityResponses?.[`p${number}`]?.finding,
      `AUDITOR_${number}_RU`,
    );
    assert.equal(
      saved.requests[0].authorityResponsesKk?.[`p${number}`]?.finding,
      `AUDITOR_${number}_KK`,
    );
  }
  assert.deepEqual(
    saved.issues.map((p) => p.auditProgramResult),
    sources,
  );
});
