import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { DocumentContent } from "../components/DocumentModal";

test("казахские вводные абзацы жалобы на действия используют реквизиты и падеж", () => {
  const c = initialState().cases[0];
  c.appealType = "Жалоба на действие/бездействие"; c.appealLanguage = "ru";
  c.org = "Русское название"; c.orgTranslations = { kk: "Ұйым" };
  c.documentApplicantNames = { request: { kk: "Ұйымның" }, certificate: { kk: "Ұйымның" }, protocol: { kk: "Ұйымның" } };
  c.applicantIdentifierType = "ИИН"; c.bin = "001002003004"; c.appealDate = "2026-09-08"; c.appealNumber = "5-Ж";
  c.agendaDetails = { ...c.agendaDetails, procurementNumber: "123", lotNumber: "45", procurementSubject: "Строительство", procurementSubjectTranslations: { kk: "Құрылыс" }, actionAppealAuthorities: [{ issuer: "КВГА", documentDate: "2026-08-07", documentNumber: "1" }, { issuer: "ДВГА по г. Алматы", documentDate: "2026-07-06", documentNumber: "2" }] };
  const reference = "Ұйымның, ЖСН: 001002003004, мемлекеттік сатып алу № 123, лот № 45, сатып алу заты: Құрылыс бойынша Қазақстан Республикасы Қаржы министрлігінің Ішкі мемлекеттік аудит комитетінің 2026 жылғы 07 тамыздағы № 1 өтінішті қарау кезіндегі әрекеттеріне (әрекетсіздігіне); Қазақстан Республикасы Қаржы министрлігінің Ішкі мемлекеттік аудит комитетінің Алматы қаласы бойынша Ішкі мемлекеттік аудит департаментінің 2026 жылғы 06 шілдедегі № 2 өтінішті қарау кезіндегі әрекеттеріне (әрекетсіздігіне) қатысты 2026 жылғы 08 қыркүйектегі № 5-Ж";
  const requestPreview = { recipient: "КВГА", deadline: "2026-10-25T18:00", template: "dvga" as const };
  const request = renderToStaticMarkup(createElement(DocumentContent, { c, kind: "request", requestPreview }));
  assert.ok(request.includes(`${reference} шағымның келіп түсуіне байланысты 2026 жылғы 25 қазанға`));
  const certificate = renderToStaticMarkup(createElement(DocumentContent, { c, kind: "certificate", language: "kk", languages: ["kk"] }));
  assert.ok(certificate.includes(`Қазақстан Республикасының Қаржы министрлігіне ${reference} шағым келіп түсті.`));
  const protocol = renderToStaticMarkup(createElement(DocumentContent, { c, kind: "protocol", language: "kk", languages: ["kk"] }));
  assert.ok(protocol.includes(`${reference} шағымы.`));
  c.agendaDetails.procurementNumber = undefined; c.agendaDetails.lotNumber = undefined; c.agendaDetails.procurementSubject = undefined; c.agendaDetails.procurementSubjectTranslations = undefined;
  const noProcurement = renderToStaticMarkup(createElement(DocumentContent, { c, kind: "request", requestPreview }));
  assert.ok(noProcurement.includes("ЖСН: 001002003004, Қазақстан Республикасы"));
});
