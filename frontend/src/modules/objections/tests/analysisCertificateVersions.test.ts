import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { addDocument, applyAction } from "../services/workflow";
import { CertificateDocuments } from "../components/CertificateDocuments";
import { DocumentContent } from "../components/DocumentModal";

const name = "Справка по результатам изучения и анализа возражения";

test("новая версия справки не расходует сквозной номер и отображается в одной строке", () => {
  let state = initialState();
  state.certificateLastNumber = 0;
  for (const item of state.cases) item.documents = item.documents.filter(document => document.kind !== "certificate");
  const ids = state.cases.slice(0, 2).map(item => item.id);
  const prepare = (id: string) => {
    const c = state.cases.find(item => item.id === id)!;
    c.status = "certificate_signed";
    c.certificate = { davgaArguments: "Доводы", memberPositions: [] };
    addDocument(c, "work", state.date, name, "certificate", "");
  };
  prepare(ids[0]);
  state = applyAction(state, ids[0], "sign-certificate", "work", new FormData());
  assert.equal(state.cases.find(item => item.id === ids[0])!.documents.at(-1)!.certificateNumber, 1);
  prepare(ids[0]);
  assert.equal(state.cases.find(item => item.id === ids[0])!.documents.at(-1)!.certificateNumber, undefined);
  state = applyAction(state, ids[0], "sign-certificate", "work", new FormData());
  assert.equal(state.certificateLastNumber, 1);
  let first = state.cases.find(item => item.id === ids[0])!;
  assert.deepEqual(first.documents.filter(item => item.name === name).map(item => item.certificateNumber), [1, 1]);
  prepare(ids[1]);
  state = applyAction(state, ids[1], "sign-certificate", "work", new FormData());
  assert.equal(state.cases.find(item => item.id === ids[1])!.documents.at(-1)!.certificateNumber, 2);
  assert.equal(state.certificateLastNumber, 2);
  first = state.cases.find(item => item.id === ids[0])!;
  const work = renderToStaticMarkup(createElement(CertificateDocuments, { c: first, role: "work", onDocument() {} }));
  assert.equal((work.match(/Справка № 1 по результатам изучения и анализа возражения/g) || []).length, 1);
  assert.match(work, /Справка № 1 по результатам изучения и анализа возражения · Версия 2/);
  assert.match(work, /История версий/);
  const commission = renderToStaticMarkup(createElement(CertificateDocuments, { c: first, role: "commission", onDocument() {} }));
  assert.match(commission, /№ 1/);
  assert.doesNotMatch(commission, /Версия 2|История версий/);
  const html = renderToStaticMarkup(createElement(DocumentContent, { c: first, kind: "certificate", document: first.documents.at(-1)! }));
  assert.match(html, /Справка № 1/);
  addDocument(first, "work", state.date, "Справка: результаты голосования членов АК", "certificate", "");
  assert.equal(first.documents.at(-1)!.certificateNumber, 1);
});

test("ранее ошибочно назначенный номер версии не подменяет номер исходной справки", () => {
  let state = initialState();
  const id = state.cases[0].id;
  const c = state.cases[0];
  c.documents = c.documents.filter(document => document.kind !== "certificate");
  c.certificate = { davgaArguments: "Доводы", memberPositions: [] };
  c.status = "certificate_signed";
  addDocument(c, "work", state.date, name, "certificate", "");
  c.documents.at(-1)!.certificateNumber = 3;
  addDocument(c, "work", state.date, name, "certificate", "");
  c.documents.at(-1)!.certificateNumber = 4;
  state.certificateLastNumber = 4;
  const html = renderToStaticMarkup(createElement(CertificateDocuments, { c, role: "work", onDocument() {} }));
  assert.match(html, /Справка № 3 по результатам изучения и анализа возражения · Версия 2/);
  assert.doesNotMatch(html, /№ 4/);
  addDocument(c, "work", state.date, name, "certificate", "");
  state = applyAction(state, id, "sign-certificate", "work", new FormData());
  assert.equal(state.cases.find(item => item.id === id)!.documents.at(-1)!.certificateNumber, 3);
  assert.equal(state.certificateLastNumber, 4);
});
