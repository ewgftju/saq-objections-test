import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import CaseWorkspace from "../pages/CaseWorkspace";
import ActionModal from "../components/ActionModal";
import { additionalActions, applyAction } from "../services/workflow";
import { subjectRoleForCase } from "../services/saqCabinets";

test("история скрыта от членов АК и прямое открытие не показывает события", () => {
  const c = initialState().cases[0];
  c.history.push({ date: "2026-10-30", actor: "Исполнитель", title: "Закрытая запись истории", text: "данные истории" });
  const render = (tab: "review" | "history") => renderToStaticMarkup(createElement(CaseWorkspace, { c, tab, role: "commission", onBack() {}, onTab() {}, onAction() {}, onDocument() {}, onUpload() {} }));
  assert.doesNotMatch(render("review"), />История</);
  assert.doesNotMatch(render("history"), /Закрытая запись истории|данные истории/);
});

test("голосование не предлагает редактирование справки, заседание сохраняет согласование", () => {
  const c = initialState().cases[0];
  c.certificate = { davgaArguments: "Доводы", memberPositions: [] };
  c.status = "commission_voting";
  assert.ok(!additionalActions(c).some((option) => option.action === "edit-certificate"));
  c.status = "meeting";
  assert.ok(additionalActions(c).some((option) => option.action === "propose-certificate-change"));
});

test("замечание направляется только после подписания заявителем, включая вложения", () => {
  let state = initialState(); const c = state.cases[0];
  c.status = "decision_project_comments";
  c.decisionProjectRouting = { channel: "saq", sentAt: state.date, commentsDeadline: "2099-12-31", recipients: [] };
  const role = subjectRoleForCase(c);
  const proposal = new FormData(); proposal.set("projectComment", "Текст замечания");
  state = applyAction(state, c.id, "submit-decision-project-comment", role, proposal);
  let saved = state.cases.find((item) => item.id === c.id)!;
  assert.equal(saved.status, "decision_project_comments");
  assert.equal(saved.decisionProjectRouting?.commentReceivedAt, undefined);
  assert.ok(!saved.documents.some((doc) => doc.kind === "decision-project-comment"));
  assert.ok(!state.notifications.some((item) => item.text.includes("Поступило замечание")));
  assert.ok(additionalActions(saved).some((option) => option.action === "sign-decision-project-comment" && option.role === role));
  const signHtml = renderToStaticMarkup(createElement(ActionModal, { c: saved, action: "sign-decision-project-comment", role, date: state.date, onSubmit() {}, onClose() {} }));
  assert.match(signHtml, /Подписать и направить/);
  assert.match(signHtml, /Текст замечания/);
  assert.throws(() => applyAction(state, c.id, "sign-decision-project-comment", role, new FormData()), /Подтвердите/);
  assert.throws(() => applyAction(state, c.id, "sign-decision-project-comment", "work", new FormData()), /недоступно/);
  saved.decisionProjectRouting!.commentDraft!.attachments = [{ name: "замечание.pdf", dataUrl: "data:application/pdf;base64,YQ==" }];
  const signed = new FormData(); signed.set("signedComment", "on");
  state = applyAction(state, c.id, "sign-decision-project-comment", role, signed);
  saved = state.cases.find((item) => item.id === c.id)!;
  assert.equal(saved.status, "decision_project_hearing");
  assert.ok(saved.decisionProjectRouting?.commentSignedAt);
  assert.equal(saved.decisionProjectRouting?.commentText, "Текст замечания");
  assert.equal(saved.decisionProjectRouting?.commentDraft, undefined);
  assert.ok(saved.documents.some((doc) => doc.kind === "decision-project-comment" && doc.text === "Текст замечания"));
  assert.ok(saved.documents.some((doc) => doc.kind === "decision-project-comment-attachment" && doc.filename === "замечание.pdf"));
  assert.ok(state.notifications.some((item) => item.recipientRole === "work" && item.text.includes("Поступило замечание")));
  assert.throws(() => applyAction(state, c.id, "sign-decision-project-comment", role, signed), /недоступно/);
});

test("заявитель не может подписать замечание после истечения срока", () => {
  let state = initialState(); const c = state.cases[0];
  c.status = "decision_project_comments";
  c.decisionProjectRouting = { channel: "saq", sentAt: state.date, commentsDeadline: state.date, recipients: [] };
  const role = subjectRoleForCase(c);
  const proposal = new FormData(); proposal.set("projectComment", "Черновик");
  state = applyAction(state, c.id, "submit-decision-project-comment", role, proposal);
  state.date = "2099-01-01";
  const signed = new FormData(); signed.set("signedComment", "on");
  assert.throws(() => applyAction(state, c.id, "sign-decision-project-comment", role, signed), /Срок/);
  const saved = state.cases.find((item) => item.id === c.id)!;
  assert.equal(saved.status, "decision_project_comments");
  assert.ok(!saved.documents.some((doc) => doc.kind === "decision-project-comment"));
});
