import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import ActionModal from "../components/ActionModal";

test("необязательные пустые доводы не отмечаются заполненными", () => {
  const state = initialState(); const c = state.cases[0];
  c.status = "decision_project"; c.appealLanguage = "kk"; c.appealType = "Жалоба на уведомление";
  const point = { ...c.issues.find(item => item.disputed)!, id: "p1", number: "1" }; c.issues = [point];
  c.certificate = { languages: ["ru", "kk"], davgaArguments: "", memberPositions: [] };
  c.votes = { p1: { yes: 1, no: 0, approved: true, chair: "chair", present: 1, eligible: 1, votes: { chair: "accept" } } };
  c.meeting = { date: state.date, number: "ПЗ-1", audio: "", signed: state.date, languages: ["ru"], protocolVersions: [{ createdAt: state.date, signedAt: state.date, languages: ["ru"], author: "Исполнитель", rows: [{ pointId: "p1", pointNumber: "1", memberId: "chair", memberName: "Председатель", vote: "accept", original: "", edited: "Доводы рабочего органа (ДАВГА МФ РК): Текст RU" }] }] };
  const render = () => renderToStaticMarkup(createElement(ActionModal, { c, action: "propose-certificate-change", role: "work", date: state.date, onSubmit() {}, onClose() {} }));
  let html = render();
  assert.match(html, /Русский · Заполнено/);
  assert.match(html, /Қазақша · Не заполнено/);
  c.meeting.protocolVersions![0].languages = ["ru", "kk"];
  c.meeting.protocolVersions![0].rows[0].editedKk = "Жұмыс органының (ҚР ҚМ ДАВГА) дәлелдері: Қазақша дәлел";
  html = render(); assert.match(html, /Қазақша · Заполнено/);
});
