import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState } from '../../../api/objectionsRepository';
import { applyAction } from '../services/workflow';

test('ответы получают номера соответствующих запросов независимо от порядка поступления', () => {
  let state = initialState();
  const c = state.cases[0];
  c.status = 'request_approved';
  c.requests = [
    { id: 'request-1', recipient: 'ДВГА по г. Астана', date: state.date, sent: state.date, text: '', deadline: '', template: 'dvga', lifecycleStatus: 'waiting_response' },
    { id: 'request-2', recipient: 'Другой орган', date: state.date, sent: state.date, text: '', deadline: '', template: 'other', lifecycleStatus: 'waiting_response' },
  ];
  const external = new FormData();
  external.set('externalRequestId', 'request-2');
  external.set('responseRegistrationNumber', 'ВХ-123');
  state = applyAction(state, c.id, 'record-external-response', 'work', external);
  let saved = state.cases.find(item => item.id === c.id)!;
  assert.equal(saved.requests[1].responseNumber, `${c.id}/2-О`);
  assert.equal(saved.requests[1].responseRegistrationNumber, 'ВХ-123');
  const form = new FormData();
  for (const point of saved.issues.filter(item => item.disputed)) {
    form.set(`authorityFinding_${point.id}`, 'Нарушение');
    form.set(`authorityResponse_${point.id}`, 'Ответ');
  }
  state = applyAction(state, c.id, 'fill-request-response', 'dvga', form);
  saved = state.cases.find(item => item.id === c.id)!;
  assert.equal(saved.requests[0].responseNumber, undefined);
  state = applyAction(state, c.id, 'approve-response', 'dvga', new FormData());
  state = applyAction(state, c.id, 'sign-response', 'dvga', new FormData());
  saved = state.cases.find(item => item.id === c.id)!;
  assert.equal(saved.requests[0].responseNumber, `${c.id}/1-О`);
  assert.equal(saved.requests[1].responseNumber, `${c.id}/2-О`);
});

test('запрос и ответ внешнего органа имеют системные номера и отдельные номера писем', () => {
  let state = initialState();
  const c = state.cases[0];
  c.status = 'accepted';
  const form = new FormData();
  form.set('recipient', 'Другой орган');
  form.set('registrationNumber', 'ИСХ-99');
  form.set('deliveryPath', 'Другая система');
  state = applyAction(state, c.id, 'request-other', 'work', form);
  let saved = state.cases.find(item => item.id === c.id)!;
  assert.equal(saved.requests[0].requestNumber, `${c.id}/1`);
  assert.equal(saved.requests[0].registrationNumber, 'ИСХ-99');
  const answer = new FormData();
  answer.set('externalRequestId', saved.requests[0].id);
  assert.throws(() => applyAction(state, c.id, 'record-external-response', 'work', answer), /Номер письма ответа/);
  answer.set('responseRegistrationNumber', 'ВХ-99');
  state = applyAction(state, c.id, 'record-external-response', 'work', answer);
  saved = state.cases.find(item => item.id === c.id)!;
  assert.equal(saved.requests[0].responseNumber, `${c.id}/1-О`);
  assert.equal(saved.requests[0].responseRegistrationNumber, 'ВХ-99');
});

test('номер и дата запроса появляются только при подписании', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DocumentContent } = await import('../components/DocumentModal');
  let state = initialState();
  const c = state.cases[0];
  c.status = 'request_signed';
  c.requests = [{ id: 'request-1', recipient: 'ДВГА по г. Астана', date: state.date, approved: state.date, text: '', deadline: '', template: 'dvga', lifecycleStatus: 'signature' }];
  const document = { name: 'Запрос', kind: 'request', text: '', date: state.date, author: 'Исполнитель', requestId: 'request-1' };
  const render = () => renderToStaticMarkup(createElement(DocumentContent, { c: state.cases[0], kind: 'request', document }));
  assert.doesNotMatch(render(), new RegExp(`${c.id}/1`));
  const form = new FormData(); form.set('requestId', 'request-1');
  state = applyAction(state, c.id, 'sign-request', 'director', form);
  assert.equal(state.cases[0].requests[0].requestNumber, `${c.id}/1`);
  assert.match(render(), new RegExp(`${c.id}/1`));
  assert.match(render(), /08\.09\.2026/);
});
