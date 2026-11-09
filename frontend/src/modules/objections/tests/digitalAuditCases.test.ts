import assert from 'node:assert/strict';
import test from 'node:test';
import { createDemoRepository, initialState, STORAGE_KEY } from '../../../api/objectionsRepository';

test('девять тестовых жалоб добавляются однократно, существующие обращения сохраняются', () => {
  const old = initialState(); old.version = 13; old.cases = old.cases.filter(c => !c.org.includes('Digital audit #'));
  const original = structuredClone(old.cases[0]); original.id = 'Ж-2026-004'; old.cases.push(original);
  const data = new Map([[STORAGE_KEY, JSON.stringify(old)]]);
  const repo = createDemoRepository({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } });
  const first = repo.load(); const complaints = first.cases.filter(c => c.org.includes('Digital audit #'));
  assert.equal(complaints.length, 9); assert.equal(new Set(first.cases.map(c => c.id)).size, first.cases.length);
  assert.ok(first.cases.some(c => c.id === original.id && c.org === original.org));
  assert.ok(complaints.every(c => c.issues.length === 2 && c.documents.length === 3 && c.documents.every(d => d.dataUrl?.startsWith('data:'))));
  complaints[0].request = 'изменено'; repo.save(first);
  const second = repo.load(); assert.equal(second.cases.filter(c => c.org.includes('Digital audit #')).length, 9);
  assert.equal(second.cases.find(c => c.id === complaints[0].id)?.request, 'изменено');
});
