import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { addDocument } from "../services/workflow";
import { DocumentContent } from "../components/DocumentModal";

test("приложение проекта решения использует доводы справки по каждому пункту и сохраняет снимок", () => {
  const c = initialState().cases[0];
  const first = c.issues.find((point) => point.disputed)!;
  const second = { ...first, id: "second-project-test", number: "2", disputed: true };
  c.issues = [first, second];
  c.certificate = { davgaArguments: "", davgaArgumentsByPoint: { [first.id]: "Доводы ДАВГА по первому пункту.\nВторая строка.", [second.id]: "Доводы ДАВГА по второму пункту" }, memberPositions: [] };
  c.result = { label: "Удовлетворить", reason: "Результаты голосования членов АК зафиксированы в протоколе.", effect: "", date: "2026-10-29", number: "1" };
  const preview = renderToStaticMarkup(createElement(DocumentContent, { c, kind: "decision-project" }));
  assert.match(preview, /Доводы ДАВГА по первому пункту\.\nВторая строка\./);
  assert.match(preview, /Доводы ДАВГА по второму пункту/);
  assert.doesNotMatch(preview, /Результаты голосования членов АК зафиксированы в протоколе/);
  addDocument(c, "work", "2026-10-29", "Проект решения", "decision-project", "");
  const document = c.documents.at(-1)!;
  c.certificate.davgaArgumentsByPoint![first.id] = "Позднее изменённые доводы";
  const saved = renderToStaticMarkup(createElement(DocumentContent, { c, kind: "decision-project", document }));
  assert.match(saved, /Доводы ДАВГА по первому пункту/);
  assert.doesNotMatch(saved, /Позднее изменённые доводы/);
  const finalResponse = renderToStaticMarkup(createElement(DocumentContent, { c, kind: "final-response" }));
  assert.match(finalResponse, /Результаты голосования членов АК зафиксированы в протоколе/);
});
