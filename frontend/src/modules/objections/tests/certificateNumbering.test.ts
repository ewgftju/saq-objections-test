import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { initialState } from '../../../api/objectionsRepository';
import { addDocument, applyAction } from '../services/workflow';
import { DocumentContent } from '../components/DocumentModal';

test('справки всех обращений нумеруются при подписании единым счётчиком, версии сохраняют номер', () => {
  let state = initialState();
  const cases = state.cases.slice(0, 2);
  for (const c of cases) {
    c.status = 'certificate_signed';
    c.certificate = { davgaArguments: 'Доводы', memberPositions: [] };
    addDocument(c, 'work', state.date, 'Справка по результатам изучения и анализа возражения', 'certificate', '');
  }
  let first = state.cases.find(c => c.id === cases[0].id)!;
  assert.equal(first.documents.at(-1)?.certificateNumber, undefined);
  state = applyAction(state, cases[0].id, 'sign-certificate', 'work', new FormData());
  state = applyAction(state, cases[1].id, 'sign-certificate', 'work', new FormData());
  first = state.cases.find(c => c.id === cases[0].id)!;
  const second = state.cases.find(c => c.id === cases[1].id)!;
  assert.equal(first.documents.at(-1)?.certificateNumber, 1);
  assert.equal(second.documents.at(-1)?.certificateNumber, 2);
  assert.equal(state.certificateLastNumber, 2);
  const html = renderToStaticMarkup(createElement(DocumentContent, { c: first, kind: 'certificate', document: first.documents.at(-1)! }));
  assert.match(html, /Справка № 1/);
  addDocument(first, 'work', state.date, 'Справка: результаты голосования членов АК', 'certificate', '');
  assert.equal(first.documents.at(-1)?.certificateNumber, 1);
  addDocument(first, 'director', state.date, 'Справка: результаты голосования членов АК. Версия 2', 'certificate', '');
  assert.equal(first.documents.at(-1)?.certificateNumber, 1);
});
