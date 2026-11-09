import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { auditAuthorityKazakhName } from "../../../utils/auditAuthority";
import { DocumentContent } from "../components/DocumentModal";

const prefix = "Қазақстан Республикасы Қаржы министрлігінің Ішкі мемлекеттік аудит комитетінің";
test("казахские наименования территориальных ДВГА полные", () => {
  assert.equal(auditAuthorityKazakhName("ДВГА по Акмолинской области"), `${prefix} Ақмола облысы бойынша Ішкі мемлекеттік аудит департаменті`);
  for (const name of ["ДВГА по Атырауской области", "ДВГА по г.Шымкент", "ДВГА по г. Астана", "ДВГА по области Абай"]) assert.ok(auditAuthorityKazakhName(name).startsWith(`${prefix} `));
  assert.equal(auditAuthorityKazakhName("КВГА"), "Қазақстан Республикасы Қаржы министрлігінің Ішкі мемлекеттік аудит комитеті");
  assert.equal(auditAuthorityKazakhName("Другой орган"), "Другой орган");
});

test("полное казахское наименование выводится в печатной справке и протоколе", () => {
  const c = initialState().cases[0];
  c.appealType = "Жалоба на действие/бездействие";
  c.issuer = "ДВГА по Акмолинской области";
  c.agendaDetails = { actionAppealAuthorities: [{ issuer: c.issuer, documentDate: "2026-09-08", documentNumber: "123" }] };
  const full = `${prefix} Ақмола облысы бойынша Ішкі мемлекеттік аудит департаменті`;
  for (const kind of ["certificate", "protocol"] as const) {
    const html = renderToStaticMarkup(createElement(DocumentContent, { c, kind, language: "kk", languages: ["kk"] }));
    assert.ok(html.includes(full), kind);
  }
});
