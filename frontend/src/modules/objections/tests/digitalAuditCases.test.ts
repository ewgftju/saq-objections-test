import assert from "node:assert/strict";
import test from "node:test";
import { createDemoRepository, initialState, STORAGE_KEY } from "../../../api/objectionsRepository";

test("перенумерация сохраняет карточки и связи с заседанием и уведомлениями", () => {
  const old = initialState(); old.version = 16;
  old.cases.find(c => c.id === "Ж-2026-001")!.id = "Ж-2026-004";
  old.cases.find(c => c.id === "Ж-2026-002")!.id = "Ж-2026-005";
  old.cases.find(c => c.id === "Ж-2026-004")!.request = "Сохранённый текст";
  old.notifications.push({ id: "n", caseId: "Ж-2026-004", recipient: "Рабочий орган", text: "Тест", date: "2026-09-08", read: false });
  old.meetings = [{ id: "m", number: 1, dateTime: "2026-09-08T10:00", caseIds: ["Ж-2026-004", "Ж-2026-005"], created: "2026-09-08" }];
  const data = new Map([[STORAGE_KEY, JSON.stringify(old)]]);
  const repo = createDemoRepository({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } });
  const result = repo.load();
  assert.equal(result.cases.find(c => c.id === "Ж-2026-001")?.request, "Сохранённый текст");
  assert.match(result.cases.find(c => c.id === "Ж-2026-002")?.org || "", /Digital audit #2/);
  assert.ok(!result.cases.some(c => ["Ж-2026-004", "Ж-2026-005"].includes(c.id)));
  assert.deepEqual(result.meetings?.[0].caseIds, ["Ж-2026-001", "Ж-2026-002"]);
  assert.equal(result.notifications.find(n => n.id === "n")?.caseId, "Ж-2026-001");
  assert.equal(repo.load().cases.filter(c => c.id === "Ж-2026-001").length, 1);
});

test("занятый номер не заменяет существующее обращение", () => {
  const old = initialState(); old.version = 16;
  const existing = old.cases.find(c => c.id === "Ж-2026-001")!;
  existing.org = "Существующее обращение";
  old.cases.push({ ...structuredClone(existing), id: "Ж-2026-004", org: "Digital audit #1" });
  const data = JSON.stringify(old);
  const repo = createDemoRepository({ getItem: () => data, setItem() {} });
  const result = repo.load();
  assert.equal(result.cases.find(c => c.id === "Ж-2026-001")?.org, "Существующее обращение");
  assert.equal(result.cases.find(c => c.id === "Ж-2026-004")?.org, "Digital audit #1");
});

test("новый реестр создаёт жалобы с номерами 001 и 002 без удалённого заявления", () => {
  const cases = initialState().cases;
  assert.match(cases.find(c => c.id === "Ж-2026-001")?.org || "", /Digital audit #1/);
  assert.match(cases.find(c => c.id === "Ж-2026-002")?.org || "", /Digital audit #2/);
  assert.ok(!cases.some(c => ["З-2026-002", "Ж-2026-004", "Ж-2026-005"].includes(c.id)));
});
