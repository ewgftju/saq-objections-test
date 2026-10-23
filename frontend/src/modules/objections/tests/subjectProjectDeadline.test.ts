import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import type { Role } from "../../../types";
import CaseWorkspace from "../pages/CaseWorkspace";

test("кабинет получателя проекта решения видит дату поступления и срок замечаний", () => {
  const c = initialState().cases[0];
  c.status = "decision_project_comments";
  c.decisionProjectRouting = {
    channel: "saq",
    sentAt: "2026-09-08",
    receivedAt: "2026-09-08",
    commentsDeadline: "2026-09-10",
    recipients: [
      {
        id: "subject",
        recipient: c.org,
        recipientRole: "subject",
        purpose: "comments",
        channel: "saq",
        status: "sent",
        sentAt: "2026-09-08",
      },
    ],
  };
  const render = (role: Role) =>
    renderToStaticMarkup(
      createElement(CaseWorkspace, {
        c,
        date: "2026-09-09",
        tab: "review",
        role,
        onBack() {},
        onTab() {},
        onAction() {},
        onDocument() {},
        onUpload() {},
      }),
    );

  const recipient = render("subject");
  assert.match(recipient, /Направить замечание к проекту решения/);
  assert.match(recipient, /<h3>Сроки<\/h3>/);
  assert.match(recipient, /Поступило<\/span><strong>08\.09\.2026<\/strong>/);
  assert.match(recipient, /Исполнить до<\/span><strong>10\.09\.2026<\/strong>/);
  assert.doesNotMatch(recipient, /Срок рассмотрения<\/span>/);

  const otherCabinet = render("subject2");
  assert.doesNotMatch(otherCabinet, /<h3>Сроки<\/h3>/);
  assert.doesNotMatch(otherCabinet, /Направить замечание к проекту решения/);

  c.decisionProjectRouting.channel = "external";
  assert.doesNotMatch(render("subject"), /<h3>Сроки<\/h3>/);
});
