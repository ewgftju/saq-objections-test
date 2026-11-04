import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { DocumentContent } from "../components/DocumentModal";
import type { DocumentLanguage } from "../../../types";

function fixture() {
  const c = initialState().cases[0];
  c.appealLanguage = "ru";
  c.appealType = "Жалоба на уведомление";
  c.org = "Заявитель";
  c.bin = "001002003004";
  c.issuer = "ДВГА по г. Астана";
  c.appealDate = "2026-10-20";
  c.appealNumber = "12";
  c.assignee = "Исполнитель";
  c.agendaDetails = undefined;
  c.documents = [];
  c.issues = [
    {
      id: "p1",
      number: "1",
      title: "Оспариваемый пункт",
      argument: "Довод заявителя",
      finding: "",
      amount: 0,
      disputed: true,
      final: "accept",
      additionalArguments: ["Дополнительный довод"],
      translations: {
        kk: {
          title: "Даулы тармақ",
          argument: "Өтініш берушінің дәлелі",
          additionalArguments: ["Қосымша дәлел"],
        },
      },
    },
  ];
  c.members = [
    {
      id: "kenbeil-dm",
      name: "Вице-министр Кеңбеил Д.М",
      present: true,
      recused: false,
      reason: "",
    },
    {
      id: "director",
      name: "Директор ДМБУА Алиева А.Т.",
      present: true,
      recused: false,
      reason: "",
    },
  ];
  c.requests = [
    {
      id: "r1",
      recipient: c.issuer,
      date: "2026-10-21",
      sent: "2026-10-21",
      deadline: "2026-10-23",
      text: "",
      template: "dvga",
      authorityResponses: {
        p1: { finding: "Нарушение", response: "Уәжді жауап" },
      },
      authorityResponsesKk: {
        p1: { finding: "Бұзушылық", response: "Уәжді жауап" },
      },
    },
  ];
  c.certificate = {
    davgaArguments: "",
    davgaArgumentsByPoint: { p1: "Доводы ДАВГА" },
    davgaArgumentsByPointKk: { p1: "ДАВГА дәлелдері" },
    memberPositions: c.members.map((member) => ({
      id: member.id,
      name: member.name,
      pointId: "p1",
      result: "accept",
      comment: "Комментарий",
      commentKk: "Түсініктеме",
    })),
  };
  const rows = c.members.map((member) => ({
    pointId: "p1",
    pointNumber: "1",
    memberId: member.id,
    memberName: member.name,
    vote: "accept",
    original: "Доводы рабочего органа (ДАВГА МФ РК): Доводы ДАВГА",
    edited:
      "Доводы ДВГА: Нарушение\n\nДоводы рабочего органа (ДАВГА МФ РК): Обоснование протокола",
    originalKk: "Жұмыс органының (ҚР ҚМ ДАВГА) дәлелдері: ДАВГА дәлелдері",
    editedKk:
      "ІМАД дәлелдері: Бұзушылық\n\nЖұмыс органының (ҚР ҚМ ДАВГА) дәлелдері: Хаттамадағы негіздеме",
  }));
  c.meeting = {
    date: "2026-10-25",
    signed: "2026-10-26",
    number: "ПЗ-10/2026-1",
    audio: "",
    recommendations: "Рекомендация",
    recommendationsKk: "Ұсыным",
    protocolVersions: [
      {
        createdAt: "2026-10-25",
        signedAt: "2026-10-26",
        author: "Исполнитель",
        rows,
      },
    ],
  };
  c.votes = {
    p1: {
      yes: 2,
      no: 0,
      approved: true,
      chair: "kenbeil-dm",
      present: 2,
      eligible: 2,
      votes: { "kenbeil-dm": "accept", director: "accept" },
    },
  };
  return c;
}

function render(kind: string, language?: DocumentLanguage) {
  const c = fixture();
  if (!language) c.appealLanguage = undefined;
  const html = renderToStaticMarkup(
    createElement(DocumentContent, {
      c,
      kind,
      languages: language ? [language] : undefined,
    }),
  );
  return html.replace(
    /^<section class="document-language-version" lang="(?:ru|kk)">([\s\S]*)<\/section>$/,
    "$1",
  );
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const layout = (html: string) => (html.match(/<[^>]+>/g) || []).join("");

// Captured from the approved templates before the language feature (c773705).
const approved: Record<string, { layout: string; russian?: string }> = {
  certificate: {
    layout: "46e0a3a6e17ee6067523e8fd2a3eee97c05155e37c0aa7470dd3cf74324a6245",
    russian: "72851b01f18d32065968128180c571ab65b3c4a5a41218b465656a7b56470e82",
  },
  protocol: {
    layout: "34e615257d0078bc210741fbfb7dc8f6c1f44133673eb7c9e9bac4a91d95cad1",
    russian: "b9a2ab755ef72cb9e1e5ad0e86ed5525fa2d60b597ccd5a5374f9e27bf66d23b",
  },
  "authority-response-appendix": {
    layout: "11153285d2b175aaf97af6962c3397020bc7ad47ccf14d7d7561f6d4f8540a16",
    russian: "9781bda474b33f928705a145b789a5132942edf3947840718c443c44bced4f27",
  },
  "decision-project": {
    layout: "85c41b8e63a17da4ed447dde9d854860cd5d5861cf03abb0c37a58b217d09a86",
  },
  "final-response": {
    layout: "9c6084112184dfe79bfa534db14fbbdbe736942c773e55a3b87b9e142e6568f6",
  },
};

for (const kind of [
  "certificate",
  "protocol",
  "authority-response-appendix",
  "decision-project",
  "final-response",
]) {
  test(`${kind}: языки сохраняют утверждённую разметку документа`, () => {
    assert.equal(hash(layout(render(kind))), approved[kind].layout);
    for (const language of ["ru", "kk"] as const) {
      assert.equal(
        hash(layout(render(kind, language))),
        approved[kind].layout,
        language,
      );
    }
    if (approved[kind].russian)
      assert.equal(hash(render(kind, "ru")), approved[kind].russian);
  });
}

test("перевод сохраняет содержание и все разделы исходных форм", () => {
  const certificate = render("certificate", "kk");
  assert.match(certificate, /certificate-template-explanation/);
  assert.match(certificate, /certificate-template-point-list/);
  assert.match(certificate, /certificate-point-votes-table/);
  assert.match(certificate, /Дополнительный довод/);
  const protocol = render("protocol", "kk");
  assert.match(protocol, /ХАТТАМА № ПЗ-10\/2026-1/);
  assert.match(protocol, /protocol-template-attendance/);
  assert.match(protocol, /Ұсынымдар: Ұсыным/);
  assert.doesNotMatch(protocol, /Рекомендация/);
  assert.match(protocol, /protocol-template-signatures/);
  for (const kind of ["decision-project", "final-response"]) {
    const html = render(kind, "kk");
    assert.match(html, /Заңның 58-4-бабының 2-тармағына сәйкес/);
    assert.match(html, /final-response-attachment-note/);
    assert.match(html, /final-response-signature/);
    assert.match(html, /final-response-appendix/);
    assert.match(html, /Хаттамадағы негіздеме/);
  }
});

test("выбор языка просмотра не переоформляет документы, сохранённые до добавления языков", () => {
  for (const kind of [
    "certificate",
    "protocol",
    "decision-project",
    "final-response",
  ]) {
    const c = fixture();
    const saved = { ...c, appealLanguage: undefined };
    c.appealLanguage = "kk";
    const html = renderToStaticMarkup(
      createElement(DocumentContent, {
        c,
        kind,
        language: "ru",
        document: {
          kind,
          name: kind === "final-response" ? "Мотивированный ответ" : kind,
          date: "2026-10-26",
          author: "Исполнитель",
          text: "",
          snapshot: saved,
        },
      }),
    );
    assert.equal(html, render(kind));
  }
});
