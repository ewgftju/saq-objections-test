import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import CaseWorkspace from "../pages/CaseWorkspace";

test("карточка показывает сохранённые языковые данные с указанием источника", () => {
  const state = initialState(); const c = state.cases[0];
  c.appealLanguage = "ru"; c.appealType = "Заявление";
  c.statementTranslations = { kk: "Заявление KZ" };
  c.agendaDetails = { procurementSubjectTranslations: { kk: "Закупка KZ" } };
  const point = c.issues.find(item => item.disputed)!; c.issues = [point];
  point.translations = { ru: { title: "Описание RU" }, kk: { title: "Описание KZ" } };
  point.certificateArgumentTranslations = { kk: "Довод заявителя KZ" };
  c.certificate = { languages: ["ru", "kk"], davgaArguments: "", davgaArgumentsByPoint: { [point.id]: "ДАВГА RU" }, davgaArgumentsByPointKk: { [point.id]: "ДАВГА KZ" }, memberPositions: [{ id: "a", name: "Член АК", pointId: point.id, result: "accept", comment: "Комментарий RU", commentKk: "Комментарий KZ" }] };
  c.requests = [{ id: "r1", recipient: "ДВГА", date: state.date, sent: state.date, responseSigned: state.date, text: "", deadline: "", template: "dvga", authorityResponses: { [point.id]: { finding: "Нарушение RU", response: "Ответ RU" } }, authorityResponsesKk: { [point.id]: { finding: "Нарушение KZ", response: "Ответ KZ" } } }];
  c.meeting = { date: state.date, number: "", audio: "", recommendations: "Рекомендация RU", recommendationsKk: "Рекомендация KZ", protocolVersions: [{ createdAt: state.date, author: "Рабочий орган", languages: ["ru", "kk"], statementTranslations: { kk: "Заявление протокола KZ" }, pointTitles: { [point.id]: { kk: "Описание протокола KZ" } }, rows: [{ pointId: point.id, pointNumber: point.number, memberId: "a", memberName: "Член АК", vote: "accept", original: "", edited: "Доводы рабочего органа (ДАВГА МФ РК): Протокол RU", editedKk: "Жұмыс органының (ҚР ҚМ ДАВГА) дәлелдері: Протокол KZ" }] }] };
  const render = (role: "work" | "dvga" | "kvga" | "commission") => renderToStaticMarkup(createElement(CaseWorkspace, { c, role, tab: "overview", onBack() {}, onTab() {}, onAction() {}, onDocument() {}, onUpload() {} }));
  const html = render("work");
  for (const text of ["Заявление KZ", "Заявление протокола KZ", "Закупка KZ", "Описание RU", "Описание KZ", "Описание протокола KZ", "Довод заявителя KZ", "ДАВГА RU", "ДАВГА KZ", "Нарушение RU", "Ответ KZ", "Комментарий KZ", "Протокол KZ", "Рекомендация KZ"]) assert.ok(html.includes(text), text);
  for (const role of ["dvga", "kvga", "commission"] as const) assert.doesNotMatch(render(role), /Данные на русском и казахском языках/);
});
