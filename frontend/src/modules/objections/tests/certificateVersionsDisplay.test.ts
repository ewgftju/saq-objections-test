import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { addDocument } from "../services/workflow";
import { CertificateDocuments } from "../components/CertificateDocuments";

test("исходные справки остаются отдельно, изменения собраны в одну строку", () => {
  const c = initialState().cases[0];
  c.documents = c.documents.filter((document) => document.kind !== "certificate");
  addDocument(c, "work", "2026-10-29", "Справка по результатам изучения и анализа возражения", "certificate", "");
  addDocument(c, "work", "2026-10-29", "Справка: результаты голосования членов АК", "certificate", "");
  addDocument(c, "director", "2026-10-29", "Справка: результаты голосования членов АК. Версия 3", "certificate", "");
  addDocument(c, "director", "2026-10-30", "Справка: результаты голосования членов АК. Версия 4", "certificate", "");
  const render = (role: "work" | "commission") => renderToStaticMarkup(createElement(CertificateDocuments, { c, role, onDocument() {} }));
  const html = render("work");
  assert.match(html, /Справка по результатам изучения и анализа возражения/);
  assert.match(html, /Справка: результаты голосования членов АК/);
  assert.equal((html.match(/Справка с учётом изменений доводов ДАВГА/g) || []).length, 1);
  assert.match(html, /История версий/);
  assert.doesNotMatch(html, /Версия 3|Версия 4/);
  assert.doesNotMatch(render("commission"), /История версий/);
  c.documents = c.documents.filter((document) => !document.name.includes("Версия"));
  assert.doesNotMatch(render("work"), /Справка с учётом изменений|История версий/);
});
