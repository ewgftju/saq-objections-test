import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { initialState } from '../../../api/objectionsRepository';
import { applyAction } from '../services/workflow';
import { DocumentContent } from '../components/DocumentModal';

const delivery = () => ({ date: '2026-09-01', number: '', receipt: '', channel: '', appealCourt: '', appealProcedure: '' });

test('проекты решения нумеруются при подписании по всем обращениям', () => {
  let state = initialState();
  const ids = state.cases.slice(0, 2).map(c => c.id);
  for (const c of state.cases.slice(0, 2)) {
    c.appealType = 'Жалоба на уведомление'; c.status = 'decision_project_signed'; c.decisionProject = delivery();
  }
  state = applyAction(state, ids[0], 'sign-decision-project', 'director', new FormData());
  state = applyAction(state, ids[1], 'sign-decision-project', 'director', new FormData());
  assert.equal(state.cases[0].decisionProject?.number, 'ПР-09/2026-1');
  assert.equal(state.cases[1].decisionProject?.number, 'ПР-09/2026-2');
  const doc = state.cases[0].documents.findLast(d => d.name === 'Подписанный проект решения')!;
  assert.equal(doc.signedDocumentNumber, 'ПР-09/2026-1');
  const html = renderToStaticMarkup(createElement(DocumentContent, { c: state.cases[0], kind: 'decision-project', document: doc }));
  assert.match(html, /ПР-09\/2026-1 от 08\.09\.2026/);
});

test('окончательные ответы получают отдельную последовательную нумерацию при подписании', () => {
  let state = initialState();
  const ids = state.cases.slice(0, 2).map(c => c.id);
  for (const c of state.cases.slice(0, 2)) { c.appealType = 'Возражение на уведомление'; c.type = 'notice'; c.status = 'final_response_signed'; c.delivery = delivery(); }
  state = applyAction(state, ids[0], 'sign-final-response', 'director', new FormData());
  state = applyAction(state, ids[1], 'sign-final-response', 'director', new FormData());
  assert.equal(state.cases[0].delivery?.number, 'Р-09/2026-1');
  assert.equal(state.cases[1].delivery?.number, 'Р-09/2026-2');
  assert.equal(state.cases[0].documents.findLast(d => d.name === 'Подписанный окончательный ответ')?.signedDocumentNumber, 'Р-09/2026-1');
});
