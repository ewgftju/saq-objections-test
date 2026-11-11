import assert from "node:assert/strict";
import test from "node:test";
import { initialState, createDemoRepository, STORAGE_KEY } from "../../../api/objectionsRepository";
import { installComplaintTestCases } from "../../../data/complaintTestCases";

test("восемь обращений доступны с приложениями и добавляются только один раз", () => {
  const base = initialState();
  const original = base.cases.filter(c => !/^ТЕСТ-[1-8]$/.test(c.appealNumber || ""));
  base.cases = original; base.version = 21;
  const memory = new Map([[STORAGE_KEY, JSON.stringify(base)]]);
  const repo = createDemoRepository({ getItem: k => memory.get(k) ?? null, setItem: (k, v) => { memory.set(k, v); } });
  const result = repo.load(); const cases = result.cases.filter(c => /^ТЕСТ-[1-8]$/.test(c.appealNumber || ""));
  assert.equal(cases.length, 8); assert.equal(new Set(result.cases.map(c => c.id)).size, result.cases.length);
  assert.equal(cases.filter(c => c.appealType === "Возражение на уведомление").length, 1);
  assert.equal(new Set(cases.filter(c => c.appealType === "Жалоба на решение КВГА/ДВГА").map(c => c.agendaDetails?.decisionKind)).size, 5);
  const action = cases.filter(c => c.appealType === "Жалоба на действие/бездействие");
  assert.equal(action.length, 2); assert.equal(action.filter(c => c.agendaDetails?.procurementNumber).length, 1);
  assert.ok(cases.every(c => c.documents.length === 2 && c.documents.every(d => d.dataUrl?.startsWith("data:"))));
  assert.equal(installComplaintTestCases(result.cases).length, result.cases.length);
  assert.equal(repo.load().cases.filter(c => /^ТЕСТ-[1-8]$/.test(c.appealNumber || "")).length, 8);
});
