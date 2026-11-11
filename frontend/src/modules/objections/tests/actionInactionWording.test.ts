import assert from "node:assert/strict";
import test from "node:test";
import { initialState } from "../../../api/objectionsRepository";
import { agendaOrProtocolIntro, certificateTemplateIntro, requestTemplateIntro } from "../services/appealTemplates";

test("шаблоны жалобы используют бездействия и разделяют органы точкой с запятой", () => {
  const c = initialState().cases[0]; c.appealType = "Жалоба на действие/бездействие";
  c.agendaDetails = { actionAppealAuthorities: [
    { issuer: "ДВГА по Атырауской области", documentNumber: "1", documentDate: "2026-09-01" },
    { issuer: "КВГА", documentNumber: "2", documentDate: "2026-09-02" },
  ] };
  for (const text of [agendaOrProtocolIntro(c), certificateTemplateIntro(c), requestTemplateIntro(c)]) {
    assert.match(text!, /касательно действий \(бездействия\)/);
    assert.match(text!, /при рассмотрении обращения №1 от 01\.09\.2026; Комитета.*при рассмотрении обращения №2 от 02\.09\.2026/);
    assert.doesNotMatch(text!, /бездействий/);
  }
  c.agendaDetails.actionAppealAuthorities!.pop();
  assert.doesNotMatch(agendaOrProtocolIntro(c)!, /;/);
});
