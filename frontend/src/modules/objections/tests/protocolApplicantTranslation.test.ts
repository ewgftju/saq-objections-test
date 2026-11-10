import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { actionForm } from "../formDefinitions";
import { addDocument, applyAction } from "../services/workflow";
import { certificateBasisForPoint, replaceProtocolApplicantArgument } from "../services/protocolReason";
import { DocumentContent } from "../components/DocumentModal";
import ActionModal from "../components/ActionModal";
import type { DocumentLanguage } from "../../../types";

function fixture(language: DocumentLanguage, fromCertificate = "") {
  const state = initialState(), c = state.cases[0];
  c.status = "meeting"; c.appealLanguage = language; c.appealType = "Возражение на аудиторский отчет";
  c.org = "Заявитель"; c.orgTranslations = { ru: "Заявитель", kk: "Өтініш беруші" };
  const target = language === "ru" ? "kk" : "ru";
  const original = language === "ru" ? "Русский исходный довод" : "Қазақша бастапқы дәлел";
  c.issues = [{ ...c.issues[0], id: "p1", number: "1", title: "Описание", argument: original, disputed: true, certificateArgumentTranslations: fromCertificate ? { [target]: fromCertificate } : {} }];
  c.certificate = { languages: [language], davgaArguments: "Доводы", davgaArgumentsByPoint: { p1: "Доводы РУ" }, davgaArgumentsByPointKk: { p1: "Дәлелдер ҚАЗ" }, memberPositions: [] };
  c.members = [{ id: "chair", name: "Председатель", present: true, recused: false, reason: "" }];
  c.documents = [];
  addDocument(c, "work", state.date, "Справка", "certificate", "");
  const form = new FormData(); form.set("documentLanguageMode", "both"); form.set("documentApplicantName_kk", "Өтініш беруші");
  form.set(`pointTitle_${target}_p1`, "Перевод описания");
  form.set("protocolVote_p1_chair", "accept"); form.set("protocolDavga_p1_chair", "Доводы РУ"); form.set("protocolDavgaKk_p1_chair", "Дәлелдер ҚАЗ");
  return { state, c, form, target, original };
}

for (const language of ["ru", "kk"] as const) test(`протокол требует и сохраняет перевод доводов заявителя: ${language}`, () => {
  const { state, c, form, target, original } = fixture(language);
  const key = `protocolArgumentTranslation_${target}_p1`;
  const field = actionForm("vote", c, state.date, { documentLanguageMode: "both" }).fields.find(item => item.name === key);
  assert.equal(field?.required, true);
  assert.equal(field?.language, target);
  assert.throws(() => applyAction(state, c.id, "vote", "work", form), /Заполните перевод доводов заявителя/);
  const translation = target === "kk" ? "Қазақша аударылған дәлел" : "Русский переведённый довод";
  form.set(key, translation);
  let next = applyAction(state, c.id, "vote", "work", form);
  let saved = next.cases.find(item => item.id === c.id)!;
  assert.equal(saved.issues[0].argument, original);
  assert.equal(saved.issues[0].protocolArgumentTranslations?.[target], translation);
  const certificate = saved.documents.find(item => item.kind === "certificate")!;
  assert.equal(certificate.snapshot?.issues[0].protocolArgumentTranslations, undefined);
  const protocol = saved.documents.filter(item => item.kind === "protocol").at(-1)!;
  const html = renderToStaticMarkup(createElement(DocumentContent, { c: saved, kind: "protocol", document: protocol, language: target }));
  assert.match(html, new RegExp(translation));
  const originalHtml = renderToStaticMarkup(createElement(DocumentContent, { c: saved, kind: "protocol", document: protocol, language }));
  assert.match(originalHtml, new RegExp(original));
  saved.issues[0].protocolArgumentTranslations![target] = "Позднее изменение";
  assert.match(renderToStaticMarkup(createElement(DocumentContent, { c: saved, kind: "protocol", document: protocol, language: target })), new RegExp(translation));
  const oldReason = certificateBasisForPoint(c, c.issues[0], target);
  saved.issues[0].protocolArgumentTranslations![target] = translation;
  assert.match(replaceProtocolApplicantArgument(oldReason, saved, saved.issues[0], target), new RegExp(translation));
  const returnForm = new FormData(); returnForm.set("returnComment", "Уточнить перевод");
  next = applyAction(next, c.id, "return-protocol", "director", returnForm);
  const revised = target === "kk" ? "Өзгертілген аударма" : "Изменённый перевод";
  form.set(key, revised);
  next = applyAction(next, c.id, "vote", "work", form);
  saved = next.cases.find(item => item.id === c.id)!;
  const row = saved.meeting!.protocolVersions!.at(-1)!.rows[0];
  assert.match(target === "kk" ? row.editedKk || "" : row.edited, new RegExp(revised));
  assert.match(renderToStaticMarkup(createElement(DocumentContent, { c: saved, kind: "protocol", document: protocol, language: target })), new RegExp(translation));
});

test("если перевод есть в справке, он подставляется в протокол без повторного ввода", () => {
  const { state, c, form } = fixture("ru", "Перевод из справки");
  assert.ok(!actionForm("vote", c, state.date, { documentLanguageMode: "both" }).fields.some(field => field.name === "protocolArgumentTranslation_kk_p1"));
  const next = applyAction(state, c.id, "vote", "work", form);
  const saved = next.cases.find(item => item.id === c.id)!;
  assert.match(saved.meeting?.protocolVersions?.at(-1)?.rows[0].editedKk || "", /Перевод из справки/);
});

test("поле перевода на казахской вкладке расположено после результатов голосования", () => {
  const { state, c } = fixture("ru");
  c.certificate!.languages = ["ru", "kk"];
  const html = renderToStaticMarkup(createElement(ActionModal, { c, action: "vote", date: state.date, role: "work", onSubmit() {}, onClose() {} }));
  const table = html.indexOf("Участники заседания и результаты голосования");
  const field = html.indexOf('name="protocolArgumentTranslation_kk_p1"');
  assert.ok(table >= 0 && field > table);
  assert.match(html, /Перевод доводов заявителя по пункту № 1 — Қазақша/);
  assert.doesNotMatch(html, /name="protocolArgumentTranslation_ru_p1"/);
});

test("отсутствующие доводы не заполняются прочерком и обоснование обязательно на каждом языке", () => {
  const { state, c, form } = fixture("ru", "Аударма");
  c.certificate!.languages = ["ru", "kk"];
  c.certificate!.davgaArgumentsByPointKk = {};
  c.documents = [];
  addDocument(c, "work", state.date, "Справка", "certificate", "");
  const html = renderToStaticMarkup(createElement(ActionModal, { c, action: "vote", date: state.date, role: "work", onSubmit() {}, onClose() {} }));
  assert.match(html, /name="protocolDavgaKk_p1_chair"[^>]*required[^>]*><\/textarea>/);
  for (const value of ["", "—", " - "]) {
    form.set("protocolDavgaKk_p1_chair", value);
    assert.throws(() => applyAction(state, c.id, "vote", "work", form), /Заполните (обоснование|поле «Доводы ДАВГА)/);
    form.set("protocolDavgaKk_p1_chair", "Қазақша дәлел");
    form.set("protocolDavga_p1_chair", value);
    assert.throws(() => applyAction(state, c.id, "vote", "work", form), /Заполните обоснование/);
    form.set("protocolDavga_p1_chair", "Русские доводы");
  }
  assert.doesNotThrow(() => applyAction(state, c.id, "vote", "work", form));
});
