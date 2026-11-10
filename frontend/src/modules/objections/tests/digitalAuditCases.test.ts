import assert from "node:assert/strict";
import test from "node:test";
import { createDemoRepository, initialState, STORAGE_KEY } from "../../../api/objectionsRepository";

test("восстанавливаются 004 и 005, заявление 002 удаляется, остальные карточки сохраняются", () => {
  const old = initialState(); old.version = 15;
  const sample = old.cases[0];
  old.cases = old.cases.filter(c => c.id !== "Ж-2026-005");
  old.cases.find(c => c.id === "Ж-2026-004")!.request = "Сохранённый изменённый текст";
  old.cases.push({ ...structuredClone(sample), id: "З-2026-002" });
  old.cases.push({ ...structuredClone(sample), id: "Ж-2026-013" });
  const data = new Map([[STORAGE_KEY, JSON.stringify(old)]]);
  const repo = createDemoRepository({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } });
  const first = repo.load();
  assert.equal(first.cases.find(c => c.id === "Ж-2026-004")?.request, "Сохранённый изменённый текст");
  assert.match(first.cases.find(c => c.id === "Ж-2026-005")?.org || "", /Digital audit #2/);
  assert.ok(!first.cases.some(c => c.id === "З-2026-002"));
  assert.ok(first.cases.some(c => c.id === "Ж-2026-013"));
  assert.equal(first.version, 16);
  const again = repo.load();
  assert.equal(again.cases.filter(c => c.id === "Ж-2026-005").length, 1);
  again.cases.push({ ...structuredClone(sample), id: "З-2026-002", org: "Новое заявление" });
  repo.save(again);
  assert.ok(repo.load().cases.some(c => c.id === "З-2026-002" && c.org === "Новое заявление"));
});

test("старый реестр сохраняет прежние данные 004 и 005 и удаляет только 006—012 и заявление 002", () => {
  const old = initialState(); old.version = 14;
  const sample = old.cases[0];
  old.cases.find(c => c.id === "Ж-2026-004")!.request = "Прежнее состояние";
  for (const id of ["З-2026-002", "Ж-2026-006", "Ж-2026-012", "Ж-2026-013"]) old.cases.push({ ...structuredClone(sample), id });
  const stored = JSON.stringify(old);
  const repo = createDemoRepository({ getItem: () => stored, setItem() {} });
  const result = repo.load();
  assert.equal(result.cases.find(c => c.id === "Ж-2026-004")?.request, "Прежнее состояние");
  assert.ok(result.cases.some(c => c.id === "Ж-2026-005"));
  assert.ok(!result.cases.some(c => ["З-2026-002", "Ж-2026-006", "Ж-2026-012"].includes(c.id)));
  assert.ok(result.cases.some(c => c.id === "Ж-2026-013"));
});

test("в новом реестре есть только запрошенные восстановленные жалобы", () => {
  const cases = initialState().cases;
  assert.ok(cases.some(c => c.id === "Ж-2026-004"));
  assert.ok(cases.some(c => c.id === "Ж-2026-005"));
  assert.ok(!cases.some(c => c.id === "З-2026-002" || /^Ж-2026-0(?:0[6-9]|1[0-2])$/.test(c.id)));
});
