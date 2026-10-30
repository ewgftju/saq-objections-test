import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState } from '../../../api/objectionsRepository';
import { applyAction } from '../services/workflow';
import { addWorkdays, executionDeadline, reviewDeadline } from '../services/deadlines';

function scenario(appealType: string, outcome: 'additional-request' | 'without-request' | 'no') {
  const state = initialState();
  const c = state.cases[0];
  c.appealType = appealType;
  c.type = appealType.includes('уведомление') ? 'notice' : 'audit';
  c.status = 'hearing_ready';
  c.hearing = { skip: false, date: state.date };
  c.pauseDays = 3;
  const oldDeadline = reviewDeadline(c);
  const form = new FormData();
  for (const [key, value] of Object.entries({subject: 'Позиция', note: 'Заслушано', recorded: 'on', hearingArgumentsPresence: outcome === 'no' ? 'no' : 'yes'})) form.set(key, value);
  if (outcome !== 'no') {
    form.set('newArgumentsReceivedAt', state.date);
    form.set('hearingOutcome', outcome);
    form.set('hearingReturnReason', 'Необходим анализ');
    form.set(`additionalArgumentPoint_${c.issues[0].id}`, 'on');
    form.set(`additionalArgument_${c.issues[0].id}`, 'Новые доводы');
  }
  const result = applyAction(state, c.id, 'hearing-held', 'work', form);
  return { state, result, saved: result.cases.find(item => item.id === c.id)!, oldDeadline, form };
}

for (const appealType of ['Возражение на уведомление', 'Возражение на аудиторский отчет']) {
  for (const outcome of ['additional-request', 'without-request'] as const) {
    test(`${appealType}: ${outcome}, продление один раз и сроки от новых доводов`, () => {
      const { state, result, saved, oldDeadline, form } = scenario(appealType, outcome);
      assert.equal(saved.extensionDays, 15);
      assert.equal(reviewDeadline(saved), addWorkdays(oldDeadline, 15));
      assert.equal(saved.status, outcome === 'additional-request' ? 'accepted' : 'materials');
      assert.equal(executionDeadline(saved), addWorkdays(state.date, outcome === 'additional-request' ? 2 : 5));
      assert.ok(saved.issues[0].additionalArguments?.includes('Новые доводы'));
      assert.ok(!result.notifications.some(n => n.caseId === saved.id && n.text.includes('15 рабочих дней')));
      assert.ok(saved.history.some(h => h.title.includes('Срок продлён')));
      saved.status = 'materials';
      saved.pauseDays += 2;
      assert.equal(executionDeadline(saved), addWorkdays(state.date, 7));
      saved.status = 'hearing_ready';
      assert.throws(() => applyAction(result, saved.id, 'hearing-held', 'work', form), /уже проведено/);
      saved.status = 'circulated';
      const members = new FormData(); members.set('position', 'Изучено'); members.set('shared', 'on');
      const after = applyAction(result, saved.id, 'members', 'work', members);
      assert.equal(after.cases.find(item => item.id === saved.id)?.status, 'meeting');
    });
  }
  test(`${appealType}: без новых доводов срок не продлевается`, () => {
    const { saved, result, oldDeadline } = scenario(appealType, 'no');
    assert.equal(saved.status, 'meeting');
    assert.equal(saved.extensionDays, 0);
    assert.equal(reviewDeadline(saved), oldDeadline);
    assert.ok(!result.notifications.some(n => n.text.includes('15 рабочих дней')));
  });
}
