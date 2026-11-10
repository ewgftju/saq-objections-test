import assert from "node:assert/strict";
import test from "node:test";
import { createDemoRepository, initialState, STORAGE_KEY } from "../../../api/objectionsRepository";

test("три возражения Audit plus доступны и в новом, и в сохранённом реестре", () => {
  const initial = initialState();
  const cases = initial.cases.filter(c => c.org.includes("Audit plus #"));
  assert.equal(cases.length, 3);
  cases.forEach((c, index) => {
    const n = index + 1;
    assert.equal(c.org, `Товарищество с ограниченной ответственностью "Audit plus #${n}"`);
    assert.equal(c.agendaDetails?.auditObjectName, c.org);
    assert.equal(c.agendaDetails?.auditObjectBin, "001002003004");
    assert.equal(c.agendaDetails?.applicantIsAuditObjectRepresentative, false);
    assert.equal(c.appealLanguage, "ru"); assert.equal(c.bin, "001002003004");
    assert.equal(c.appealNumber, `${n}-ВА`); assert.equal(c.document.number, `${n}-АО`);
    assert.equal(c.appealDate, "2026-09-08"); assert.equal(c.document.received, "2026-09-08");
    assert.equal(c.document.date, "2026-09-05"); assert.equal(c.address, "г. Алматы");
    assert.equal(c.issuer, "ДВГА по Атырауской области"); assert.equal(c.channel, "ОДО");
    assert.equal(c.request, "Краткое описание рус");
    assert.equal(c.issues[0].number, "4"); assert.equal(c.issues[0].title, "Рус описание оспариваемого вопроса");
    assert.equal(c.issues[0].argument, "Рус довод заявителя");
    assert.equal(c.documents.length, 2);
    assert.equal(c.documents[0].text, "Требования заявителя");
    assert.match(c.documents[1].text, /Доказательства/);
    assert.equal(c.documents[0].dataUrl, c.documents[1].dataUrl);
    assert.match(c.documents[0].dataUrl || "", /base64,UEsDB/);
  });
  const old = initialState(); old.version = 17; old.cases = old.cases.filter(c => !c.org.includes("Audit plus #") && !c.org.startsWith("Тестов Тест Тестович #"));
  const preserved = old.cases[0]; preserved.request = "Сохранённые данные";
  const data = new Map([[STORAGE_KEY, JSON.stringify(old)]]);
  const repo = createDemoRepository({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } });
  const migrated = repo.load();
  assert.equal(migrated.cases.filter(c => c.org.includes("Audit plus #")).length, 3);
  assert.equal(migrated.cases.filter(c => c.org.startsWith("Тестов Тест Тестович #")).length, 3);
  assert.equal(migrated.cases.find(c => c.id === preserved.id)?.request, "Сохранённые данные");
  assert.equal(new Set(migrated.cases.map(c => c.id)).size, migrated.cases.length);
  assert.equal(repo.load().cases.filter(c => c.org.includes("Audit plus #")).length, 3);
  assert.equal(repo.load().cases.filter(c => c.org.startsWith("Тестов Тест Тестович #")).length, 3);
});

test("три заявления Тестова содержат заданные сведения и вложения", () => {
  const statements = initialState().cases.filter(c => c.org.startsWith("Тестов Тест Тестович #"));
  assert.equal(statements.length, 3);
  statements.forEach((c, index) => {
    const n = index + 1;
    assert.equal(c.appealType, "Заявление"); assert.equal(c.type, "control"); assert.equal(c.appealLanguage, "ru");
    assert.equal(c.org, `Тестов Тест Тестович #${n}`); assert.equal(c.bin, "001002003004");
    assert.equal(c.applicantIdentifierType, "БИН"); assert.equal(c.applicant, "");
    assert.equal(c.agendaDetails?.applicantIsAuditObjectRepresentative, false);
    assert.equal(c.agendaDetails?.auditObjectName, `Товарищество с ограниченной ответственностью "Audit plus #${n}"`);
    assert.equal(c.agendaDetails?.auditObjectBin, "001002003004");
    assert.equal(c.appealNumber, `${n}-ВА`); assert.equal(c.appealDate, "2026-09-08");
    assert.equal(c.document.received, "2026-09-08"); assert.equal(c.address, "г. Алматы");
    assert.equal(c.issuer, "ДВГА по Атырауской области"); assert.equal(c.channel, "ОДО");
    assert.equal(c.request, "о строительстве школы");
    assert.equal(c.issues[0].number, "1"); assert.equal(c.issues[0].title, "Рус описание оспариваемого вопроса");
    assert.equal(c.issues[0].argument, "Рус довод заявителя");
    assert.equal(c.documents.length, 2); assert.equal(c.documents[0].text, "Требования заявителя");
    assert.match(c.documents[1].text, /Доказательства/);
    assert.equal(c.documents[0].dataUrl, c.documents[1].dataUrl);
    assert.match(c.documents[0].dataUrl || "", /base64,UEsDB/);
  });
});
