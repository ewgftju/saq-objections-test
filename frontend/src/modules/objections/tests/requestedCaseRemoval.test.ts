import assert from "node:assert/strict";
import test from "node:test";
import { createDemoRepository, initialState, STORAGE_KEY } from "../../../api/objectionsRepository";

const removed = ["В-2026-002", "В-2026-007", "В-2026-008", "З-2026-010", "З-2026-011", "З-2026-012", "З-2026-013", "З-2026-014"];
test("однократно удаляет указанные обращения и связанные уведомления", () => {
  const state = initialState();
  const template = state.cases[0];
  state.version = 19;
  state.cases = [...removed.map(id => ({ ...structuredClone(template), id })), { ...structuredClone(template), id: "З-2026-015" }];
  state.notifications = removed.map((id, i) => ({ id: `n${i}`, caseId: id, recipient: "Рабочий орган", recipientRole: "work", date: state.date, read: false, text: "тест" }));
  const memory = new Map([[STORAGE_KEY, JSON.stringify(state)]]);
  const repository = createDemoRepository({ getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); } });
  const loaded = repository.load();
  assert.ok(removed.every(id => !loaded.cases.some(c => c.id === id)));
  assert.ok(loaded.cases.some(c => c.id === "З-2026-015"));
  assert.equal(loaded.notifications.filter(n => removed.includes(n.caseId)).length, 0);
  assert.equal(loaded.version, 21);
  loaded.cases.push({ ...structuredClone(template), id: "З-2026-014" });
  repository.save(loaded);
  assert.ok(repository.load().cases.some(c => c.id === "З-2026-014"));
  assert.ok(removed.every(id => !initialState().cases.some(c => c.id === id)));
});

test("удаляет Ж-2026-002 из версии 20 и не затрагивает заново созданные номера", () => {
  const state = initialState();
  const template = state.cases[0];
  state.version = 20;
  state.cases.push({ ...structuredClone(template), id: "Ж-2026-002" }, { ...structuredClone(template), id: "З-2026-014" });
  const memory = new Map([[STORAGE_KEY, JSON.stringify(state)]]);
  const repository = createDemoRepository({ getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); } });
  const loaded = repository.load();
  assert.ok(!loaded.cases.some(c => c.id === "Ж-2026-002"));
  assert.ok(loaded.cases.some(c => c.id === "З-2026-014"));
  assert.ok(!initialState().cases.some(c => c.id === "Ж-2026-002"));
});
