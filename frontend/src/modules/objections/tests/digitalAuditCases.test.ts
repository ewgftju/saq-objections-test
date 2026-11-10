import assert from "node:assert/strict";
import test from "node:test";
import { createDemoRepository, initialState, STORAGE_KEY } from "../../../api/objectionsRepository";

test("удаляются только жалобы Ж-2026-004 — Ж-2026-012, изменения сохраняются при повторной загрузке", () => {
  const old = initialState();
  old.version = 14;
  const sample = old.cases[0];
  const ids = Array.from({ length: 11 }, (_, n) => `Ж-2026-${String(n + 3).padStart(3, "0")}`);
  for (const id of ids) old.cases.push({ ...structuredClone(sample), id, org: id });
  const data = new Map([[STORAGE_KEY, JSON.stringify(old)]]);
  const repo = createDemoRepository({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } });
  const first = repo.load();
  assert.ok(first.cases.some(c => c.id === "Ж-2026-003"));
  assert.ok(first.cases.some(c => c.id === "Ж-2026-013"));
  assert.ok(ids.slice(1, 10).every(id => !first.cases.some(c => c.id === id)));
  assert.equal(first.version, 15);
  const again = repo.load();
  assert.ok(ids.slice(1, 10).every(id => !again.cases.some(c => c.id === id)));
  again.cases.push({ ...structuredClone(sample), id: "Ж-2026-004", org: "Новое обращение" });
  repo.save(again);
  assert.ok(repo.load().cases.some(c => c.id === "Ж-2026-004" && c.org === "Новое обращение"));
});

test("установленный набор больше не создаёт удалённые тестовые жалобы", () => {
  assert.ok(initialState().cases.every(c => !/^Ж-2026-0(?:0[4-9]|1[0-2])$/.test(c.id)));
});
