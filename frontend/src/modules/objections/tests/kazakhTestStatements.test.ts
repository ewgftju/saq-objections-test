import assert from "node:assert/strict";
import test from "node:test";
import { createDemoRepository, initialState, STORAGE_KEY } from "../../../api/objectionsRepository";

test("казахские тестовые заявления содержат заданные данные и вложения", () => {
  const cases = initialState().cases.filter(c => c.org.startsWith("Тестов Тест Тестұлы #"));
  assert.equal(cases.length, 3);
  cases.forEach((c, index) => {
    const n = index + 4, name = `Тестов Тест Тестұлы #${n}`;
    assert.equal(c.appealType, "Заявление"); assert.equal(c.appealLanguage, "kk");
    assert.equal(c.org, name); assert.equal(c.orgTranslations?.kk, name); assert.equal(c.bin, "001002003004");
    assert.equal(c.agendaDetails?.auditObjectName, name); assert.equal(c.agendaDetails?.auditObjectBin, "001002003004");
    assert.equal(c.agendaDetails?.applicantIsAuditObjectRepresentative, false);
    assert.equal(c.appealNumber, `${n}-ВА`); assert.equal(c.appealDate, "2026-09-07");
    assert.equal(c.document.received, "2026-09-08"); assert.equal(c.address, "г. Астана");
    assert.equal(c.issuer, "КВГА"); assert.equal(c.channel, "ОДО"); assert.equal(c.request, "мектеп салу туралы");
    assert.equal(c.issues[0].number, "1"); assert.equal(c.issues[0].title, "Каз описание оспариваемого вопроса");
    assert.equal(c.issues[0].argument, "каз довод заявителя");
    assert.equal(c.documents.length, 2); assert.equal(c.documents[0].name, "Тест 2.docx");
    assert.equal(c.documents[0].dataUrl, c.documents[1].dataUrl); assert.match(c.documents[0].dataUrl || "", /base64,UEsDB/);
  });
});

test("добавление в существующий реестр не перезаписывает карточки и не создаёт дубликаты", () => {
  const old = initialState(); old.version = 18;
  old.cases = old.cases.filter(c => !c.org.endsWith("#5") && !c.org.endsWith("#6"));
  const existing = old.cases.find(c => c.org === "Тестов Тест Тестұлы #4")!;
  existing.request = "Сохранённые изменения";
  let saved = JSON.stringify(old);
  const repo = createDemoRepository({ getItem: key => key === STORAGE_KEY ? saved : null, setItem: (_key, value) => { saved = value; } });
  const migrated = repo.load();
  assert.equal(migrated.cases.filter(c => c.org.startsWith("Тестов Тест Тестұлы #")).length, 3);
  assert.equal(migrated.cases.find(c => c.org === existing.org)?.request, "Сохранённые изменения");
  assert.equal(new Set(migrated.cases.map(c => c.id)).size, migrated.cases.length);
  assert.equal(repo.load().cases.filter(c => c.org.startsWith("Тестов Тест Тестұлы #")).length, 3);
});
