import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import { applyAction } from "../services/workflow";
import { DocumentContent, wordDocumentHtml } from "../components/DocumentModal";
import ActionModal from "../components/ActionModal";
import {
  certificateBasisForPoint,
  decisionProjectDavga,
} from "../services/protocolReason";
import type { Action, DocumentLanguage, Role } from "../../../types";
import { actionForm } from "../formDefinitions";
import { localizedCase, pointText } from "../services/documentLanguage";

test("в электронной форме протокола нет языковых полей описания и доводов заявителя", () => {
  const h = fixture("ru");
  h.c.status = "meeting";
  h.c.certificate = { languages: ["ru", "kk"], davgaArguments: "", memberPositions: [] };
  h.c.issues[0].translations = { ru: { title: "Пункт RU" }, kk: { title: "Тармақ KZ" } };
  h.c.members = [{ id: "chair", name: "Председатель комиссии", present: true, recused: false, reason: "" }];
  const fields = actionForm("vote", h.c, h.state.date, { documentLanguageMode: "both" }).fields;
  assert.ok(fields.some(field => field.name === "documentLanguageMode"));
  assert.ok(fields.some(field => field.name === "recommendations"));
  assert.ok(fields.some(field => field.name === "recommendationsKk"));
  assert.ok(fields.every(field => !/^(pointTitle|pointArgument|pointAdditional)_/.test(field.name)));
  const html = renderToStaticMarkup(createElement(ActionModal, { c: h.c, action: "vote", role: "work", date: h.state.date, onClose() {}, onSubmit() {} }));
  assert.doesNotMatch(html, /name="point(?:Title|Argument|Additional)_/);
  for (const language of ["ru", "kk"] as const) {
    const preview = renderToStaticMarkup(createElement(DocumentContent, { c: h.c, kind: "protocol", languages: ["ru", "kk"], language }));
    assert.match(preview, language === "ru" ? /Пункт RU/ : /Тармақ KZ/);
  }
});

test("справка по уведомлению перечисляет оспариваемые пункты на языке документа", () => {
  const h = fixture("ru");
  h.c.type = "notice";
  h.c.request = "Краткое описание обращения";
  h.c.issues[0].translations = { ru: { title: "Оспариваемый вопрос RU" }, kk: { title: "Даулы мәселе KZ" } };
  h.c.issues.push({ ...h.c.issues[0], id: "p2", number: "2", title: "Второй вопрос", translations: { ru: { title: "Второй вопрос RU" }, kk: { title: "Екінші мәселе KZ" } } });
  h.c.issues.push({ ...h.c.issues[0], id: "p3", number: "3", disputed: false, title: "Не оспаривается" });
  for (const language of ["ru", "kk"] as const) {
    const html = renderToStaticMarkup(createElement(DocumentContent, { c: h.c, kind: "certificate", languages: ["ru", "kk"], language }));
    const list = html.match(/<ol class="certificate-template-point-list">([\s\S]*?)<\/ol>/)![1];
    assert.match(list, language === "ru" ? /Оспариваемый вопрос RU/ : /Даулы мәселе KZ/);
    assert.match(list, language === "ru" ? /Второй вопрос RU/ : /Екінші мәселе KZ/);
    assert.doesNotMatch(list, /Краткое описание обращения|Не оспаривается/);
  }
});

function fixture(language: DocumentLanguage) {
  let state = initialState();
  const id = state.cases[0].id;
  let c = state.cases[0];
  c.appealLanguage = language;
  c.status = "request_approved";
  c.issues = [
    {
      id: "p1",
      number: "1",
      title: language === "ru" ? "Русский пункт" : "Қазақша тармақ",
      argument: language === "ru" ? "Довод заявителя RU" : "Өтініш беруші KZ",
      finding: "",
      amount: 0,
      disputed: true,
    },
  ];
  c.requests = [
    {
      id: "request-1",
      recipient: "ДВГА по г. Астана",
      date: state.date,
      sent: state.date,
      text: "",
      deadline: "",
      template: "dvga",
    },
  ];
  const run = (
    action: Action,
    role: Role,
    values: Record<string, string> = {},
  ) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    state = applyAction(state, id, action, role, form);
    c = state.cases.find((item) => item.id === id)!;
  };
  return {
    get state() {
      return state;
    },
    get c() {
      return c;
    },
    run,
  };
}

for (const primary of ["ru", "kk"] as const) {
  test(`${primary}: описание редактируется и сохраняется, доводы заявителя остаются без изменений`, () => {
    const h = fixture(primary);
    h.c.status = "materials";
    const originalTitle = h.c.issues[0].title;
    const originalArgument = h.c.issues[0].argument;
    const values = {
      documentLanguageMode: "both",
      pointTitle_ru_p1: "Исправленное описание RU",
      pointTitle_kk_p1: "Түзетілген сипаттама KZ",
      pointArgument_ru_p1: "Подмена довода",
      pointArgument_kk_p1: "Подмена довода",
      certificateApplicantArgument_p1: "Подмена довода",
      davgaArguments_p1: "Доводы ДАВГА RU",
      davgaArgumentsKk_p1: "ДАВГА дәлелдері KZ",
    };
    h.c.analysisDraft = { values, savedAt: h.state.date };
    const fields = actionForm("analysis", h.c, h.state.date, values).fields;
    assert.ok(
      fields
        .filter((field) => field.name.startsWith("pointTitle_"))
        .every((field) => !field.readOnly),
    );
    assert.ok(fields.some(field => field.label === `Описание оспариваемого вопроса № 1 — ${primary === "ru" ? "Русский" : "Қазақша"}`));
    const applicantFields = fields.filter((field) =>
      field.name.startsWith("pointArgument_"),
    );
    assert.equal(applicantFields.length, 2);
    assert.ok(applicantFields.every(field => field.label === "Доводы заявителя по пункту № 1"));
    assert.ok(
      applicantFields.every(
        (field) => field.readOnly && field.value === originalArgument,
      ),
    );
    const modal = renderToStaticMarkup(
      createElement(ActionModal, {
        c: h.c,
        action: "analysis",
        role: "work",
        date: h.state.date,
        onClose() {},
        onSubmit() {},
        onSaveDraft() {},
      }),
    );
    const inputs = [
      ...modal.matchAll(
        /<textarea([^>]*)name="pointArgument_(ru|kk)_p1"([^>]*)>([^<]*)<\/textarea>/g,
      ),
    ];
    assert.equal(inputs.length, 2);
    for (const input of inputs) {
      assert.match(input[0], /readonly/i);
      assert.equal(input[4], originalArgument);
    }
    const preview = modal.match(
      /<article class="print-document certificate-template">([\s\S]*?)<\/article>/,
    )![1];
    assert.ok(preview.includes(values[`pointTitle_${primary}_p1`]));
    assert.ok(preview.includes(originalArgument));
    assert.doesNotMatch(preview, /Подмена довода/);
    h.run("analysis", "work", values);
    assert.equal(h.c.issues[0].title, originalTitle);
    assert.equal(h.c.issues[0].argument, originalArgument);
    const document = structuredClone(h.c.documents.at(-1)!);
    for (const language of ["ru", "kk"] as const) {
      const effective = localizedCase(h.c, language).issues[0];
      assert.equal(effective.title, values[`pointTitle_${language}_p1`]);
      assert.equal(effective.argument, originalArgument);
      assert.ok(
        certificateBasisForPoint(h.c, h.c.issues[0], language).includes(
          originalArgument,
        ),
      );
      const html = renderToStaticMarkup(
        createElement(DocumentContent, {
          c: h.c,
          kind: "certificate",
          document,
          language,
        }),
      );
      assert.ok(html.includes(values[`pointTitle_${language}_p1`]));
      assert.ok(html.includes(originalArgument));
      assert.doesNotMatch(html, /Подмена довода/);
    }
    h.c.status = "meeting";
    h.c.members = [
      {
        id: "chair",
        name: "Председатель комиссии",
        present: true,
        recused: false,
        reason: "",
      },
    ];
    h.run("vote", "work", {
      documentLanguageMode: "both",
      protocolVote_p1_chair: "accept",
      protocolDavga_p1_chair: "Протокол RU",
      protocolDavgaKk_p1_chair: "Хаттама KZ",
    });
    const row = h.c.meeting!.protocolVersions!.at(-1)!.rows[0];
    assert.ok(row.edited.includes(originalArgument));
    assert.ok(row.editedKk?.includes(originalArgument));
    h.c.issues[0].translations!.ru!.title = "Поздняя правка описания";
    for (const language of ["ru", "kk"] as const) {
      const html = renderToStaticMarkup(
        createElement(DocumentContent, {
          c: h.c,
          kind: "certificate",
          document,
          language,
        }),
      );
      assert.ok(html.includes(values[`pointTitle_${language}_p1`]));
      assert.ok(html.includes(originalArgument));
      assert.doesNotMatch(html, /Поздняя правка|Подмена довода/);
    }
  });

  test(`${primary}: доводы заявителя и дополнения одинаковы в обеих версиях приложения, включая сохранённый документ`, () => {
    const h = fixture(primary);
    const point = h.c.issues[0];
    const original = point.argument;
    point.additionalArguments = ["Исходный дополнительный довод"];
    point.translations = {
      ru: {
        argument: "Старый перевод RU",
        additionalArguments: ["Перевод дополнения RU"],
      },
      kk: {
        argument: "Старый перевод KZ",
        additionalArguments: ["Перевод дополнения KZ"],
      },
    };
    const saved = structuredClone(h.c);
    for (const language of ["ru", "kk"] as const) {
      assert.equal(pointText(h.c, point, "argument", language), original);
      const localized = localizedCase(h.c, language);
      assert.equal(localized.issues[0].argument, original);
      assert.deepEqual(
        localized.issues[0].additionalArguments,
        point.additionalArguments,
      );
    }
    for (const savedDocument of [false, true]) {
      if (savedDocument) point.argument = "Поздняя правка исходного довода";
      for (const language of ["ru", "kk"] as const) {
        const html = renderToStaticMarkup(
          createElement(DocumentContent, {
            c: h.c,
            kind: "authority-response-appendix",
            language,
            languages: ["ru", "kk"],
            document: savedDocument
              ? {
                  name: "Ответ ДВГА",
                  kind: "authority-response-appendix",
                  date: h.state.date,
                  text: "",
                  author: "Исполнитель",
                  requestId: "request-1",
                  languages: ["ru", "kk"],
                  snapshot: saved,
                }
              : undefined,
          }),
        );
        assert.ok(html.includes(`<div>${original}</div>`));
        assert.match(html, /Исходный дополнительный довод/);
        assert.doesNotMatch(
          html,
          /Старый перевод|Перевод дополнения|Поздняя правка/,
        );
      }
    }
    assert.equal(
      saved.issues[0].translations?.kk?.argument,
      "Старый перевод KZ",
    );
  });

  test(`${primary}: справка и протокол формируются без перевода доводов заявителя`, () => {
    const h = fixture(primary);
    const original = h.c.issues[0].argument;
    h.c.issues[0].additionalArguments = ["Исходное дополнение"];
    h.c.status = "materials";
    const other = primary === "ru" ? "kk" : "ru";
    const fields = actionForm("analysis", h.c, h.state.date, {
      documentLanguageMode: "both",
      [`pointArgument_${other}_p1`]: "Подмена из старого черновика",
    }).fields;
    for (const field of fields.filter(
      (field) =>
        field.name.startsWith("pointArgument_") ||
        field.name.startsWith("pointAdditional_"),
    )) {
      assert.equal(field.readOnly, true);
      assert.equal(
        field.value,
        field.name.startsWith("pointArgument_")
          ? original
          : "Исходное дополнение",
      );
    }
    h.run("analysis", "work", {
      documentLanguageMode: "both",
      [`pointTitle_${other}_p1`]: "Описание на втором языке",
      davgaArguments_p1: "Доводы ДАВГА RU",
      davgaArgumentsKk_p1: "ДАВГА дәлелдері KZ",
      [`pointArgument_${other}_p1`]: "Подмена",
      [`pointAdditional_${other}_p1_0`]: "Подмена дополнения",
    });
    assert.equal(h.c.issues[0].argument, original);
    assert.deepEqual(h.c.issues[0].additionalArguments, [
      "Исходное дополнение",
    ]);
    assert.equal(h.c.issues[0].translations?.[other]?.argument, undefined);
    h.c.status = "meeting";
    h.c.members = [
      {
        id: "chair",
        name: "Председатель комиссии",
        present: true,
        recused: false,
        reason: "",
      },
    ];
    h.run("vote", "work", {
      documentLanguageMode: "both",
      protocolVote_p1_chair: "accept",
      protocolDavga_p1_chair: "Протокол RU",
      protocolDavgaKk_p1_chair: "Хаттама KZ",
    });
    const row = h.c.meeting!.protocolVersions!.at(-1)!.rows[0];
    for (const reason of [row.edited, row.editedKk]) {
      assert.ok(reason?.includes(original));
      assert.ok(reason?.includes("Исходное дополнение"));
      assert.doesNotMatch(reason!, /Подмена/);
    }
  });
}

test("пустое описание не сохраняется при формировании справки", () => {
  const h = fixture("kk");
  h.c.status = "materials";
  assert.throws(
    () =>
      h.run("analysis", "work", {
        documentLanguageMode: "both",
        pointTitle_ru_p1: "Описание RU",
        pointTitle_kk_p1: " ",
        davgaArguments_p1: "Доводы RU",
        davgaArgumentsKk_p1: "Дәлелдер KZ",
      }),
    /Заполните описание/,
  );
  assert.equal(h.c.status, "materials");
  assert.equal(h.c.certificate, undefined);
});
for (const language of ["ru", "kk"] as const)
  test(`${language}: двуязычный ответ → справка → протокол → проект → мотивированный ответ`, () => {
    const h = fixture(language);
    assert.throws(
      () =>
        h.run("fill-request-response", "dvga", {
          authorityFinding_p1: "Нарушение RU",
          authorityResponse_p1: "Ответ RU",
        }),
      /Қазақша/,
    );
    h.run("fill-request-response", "dvga", {
      authorityFinding_p1: "Нарушение RU",
      authorityResponse_p1: "Ответ RU",
      authorityFindingKk_p1: "Бұзушылық KZ",
      authorityResponseKk_p1: "Жауап KZ",
    });
    h.run("approve-response", "dvga");
    h.run("sign-response", "dvga");
    const other = language === "ru" ? "kk" : "ru";
    h.run("analysis", "work", {
      documentLanguageMode: "both",
      davgaArguments_p1: "Доводы ДАВГА RU",
      davgaArgumentsKk_p1: "ДАВГА дәлелдері KZ",
      [`pointTitle_${other}_p1`]:
        other === "ru" ? "Русский пункт" : "Қазақша тармақ",
      [`pointArgument_${other}_p1`]:
        other === "ru" ? "Довод заявителя RU" : "Өтініш беруші KZ",
    });
    assert.equal(h.c.certificate?.languages?.length, 2);
    const certificate = h.c.documents.at(-1)!;
    const kkHtml = renderToStaticMarkup(
      createElement(DocumentContent, {
        c: h.c,
        kind: "certificate",
        document: certificate,
        language: "kk",
      }),
    );
    assert.match(kkHtml, /Анықтама/);
    assert.match(kkHtml, /Бұзушылық KZ/);
    assert.match(kkHtml, /ДАВГА дәлелдері KZ/);
    assert.doesNotMatch(kkHtml, /Доводы ДАВГА RU/);
    const download = wordDocumentHtml({
      c: h.c,
      kind: "certificate",
      document: certificate,
    });
    assert.match(download, /Анықтама/);
    assert.match(download, /Справка/);
    h.run("approve-certificate", "deputy");
    h.run("sign-certificate", "work");
    h.c.status = "meeting";
    h.c.members = [
      {
        id: "chair",
        name: "Председатель комиссии",
        present: true,
        recused: false,
        reason: "",
      },
    ];
    h.run("vote", "work", {
      documentLanguageMode: "both",
      protocolVote_p1_chair: "accept",
      protocolDavga_p1_chair: "Протокол RU",
      protocolDavgaKk_p1_chair: "Хаттама KZ",
    });
    h.run("sign", "commission", { signed_chair: "on", reason: "Итог" });
    assert.equal(decisionProjectDavga(h.c, "p1", "kk"), "Хаттама KZ");
    h.c.status = "decision_project";
    h.run("create-decision-project", "work");
    h.run("approve-decision-project", "deputy");
    h.run("sign-decision-project", "director");
    const project = h.c.documents.at(-1)!;
    assert.deepEqual(project.languages, [language]);
    const projectHtml = renderToStaticMarkup(
      createElement(DocumentContent, {
        c: h.c,
        kind: "decision-project",
        document: project,
      }),
    );
    assert.match(projectHtml, language === "kk" ? /Хаттама KZ/ : /Протокол RU/);
    assert.doesNotMatch(
      projectHtml,
      language === "kk" ? /Протокол RU/ : /Хаттама KZ/,
    );
    h.c.status = "decided";
    h.run("deliver", "work", { motivatedResponseApplicantChannel: "saq" });
    const response = h.c.documents
      .filter((d) => d.kind === "final-response")
      .at(-1)!;
    assert.deepEqual(response.languages, [language]);
    const responseHtml = renderToStaticMarkup(
      createElement(DocumentContent, {
        c: h.c,
        kind: "final-response",
        document: response,
      }),
    );
    assert.match(
      responseHtml,
      language === "kk" ? /Хаттама KZ/ : /Протокол RU/,
    );
    const savedProject = JSON.parse(JSON.stringify(project));
    h.c.decisionProjectDavgaOverrides = {
      protocolSignedAt: h.c.meeting!.protocolVersions!.at(-1)!.signedAt!,
      byPoint: { p1: "Новая правка RU" },
      byPointKk: { p1: "Кейінгі өзгеріс KZ" },
    };
    assert.equal(
      renderToStaticMarkup(
        createElement(DocumentContent, {
          c: h.c,
          kind: "decision-project",
          document: savedProject,
        }),
      ),
      projectHtml,
    );
    // Later changes do not alter the generated language version.
    h.c.certificate!.davgaArgumentsByPointKk!.p1 = "Позднее изменение";
    assert.equal(
      renderToStaticMarkup(
        createElement(DocumentContent, {
          c: h.c,
          kind: "certificate",
          document: certificate,
          language: "kk",
        }),
      ),
      kkHtml,
    );
  });

test("при отсутствии перевода он не подменяется оригиналом", () => {
  const h = fixture("kk");
  h.c.status = "materials";
  assert.throws(
    () =>
      h.run("analysis", "work", {
        documentLanguageMode: "both",
        davgaArguments_p1: "RU",
        davgaArgumentsKk_p1: "KZ",
      }),
    /Русский/,
  );
  h.run("analysis", "work", {
    documentLanguageMode: "kk",
    davgaArgumentsKk_p1: "KZ",
  });
  assert.deepEqual(h.c.certificate?.languages, ["kk"]);
});

test("двуязычные поля и выбор языка доступны в формах", () => {
  const h = fixture("kk");
  const html = renderToStaticMarkup(
    createElement(ActionModal, {
      c: h.c,
      action: "fill-request-response",
      role: "dvga",
      date: h.state.date,
      onClose() {},
      onSubmit() {},
    }),
  );
  assert.match(html, /authorityFindingKk_p1/);
  assert.match(html, /authorityFinding_p1/);
  const fields = actionForm("analysis", h.c, h.state.date, {}).fields;
  assert.deepEqual(
    fields
      .find((f) => f.name === "documentLanguageMode")
      ?.options?.map((v) => v[0]),
    ["ru", "kk", "both"],
  );
});

test("при добавлении второго языка на этапе протокола запрашиваются переводы", () => {
  const h = fixture("ru");
  h.c.status = "materials";
  h.run("analysis", "work", {
    documentLanguageMode: "ru",
    davgaArguments_p1: "Доводы RU",
  });
  h.c.status = "meeting";
  h.c.members = [
    {
      id: "chair",
      name: "Председатель комиссии",
      present: true,
      recused: false,
      reason: "",
    },
  ];
  const values = {
    documentLanguageMode: "both",
    protocolVote_p1_chair: "accept",
    protocolDavga_p1_chair: "RU",
    protocolDavgaKk_p1_chair: "KZ",
  };
  const fields = actionForm("vote", h.c, h.state.date, values).fields;
  assert.ok(fields.some(field => field.name === "pointTitle_kk_p1" && field.required));
  assert.ok(!fields.some(field => field.name === "pointTitle_ru_p1"));
  const certificate = h.c.documents.find(item => item.kind === "certificate")!;
  h.c.certificate!.languages = ["ru", "kk"];
  const modal = renderToStaticMarkup(createElement(ActionModal, { c: h.c, action: "vote", role: "work", date: h.state.date, onClose() {}, onSubmit() {} }));
  assert.ok(modal.indexOf("Участники заседания и результаты голосования") < modal.indexOf("Перевод описания пункта № 1"));
  h.c.certificate!.languages = ["ru"];
  assert.throws(() => h.run("vote", "work", values), /Қазақша/);
  h.run("vote", "work", {
    ...values,
    pointTitle_ru_p1: "Попытка подмены",
    pointTitle_kk_p1: "Тармақ KZ",
    pointArgument_kk_p1: "Дәлел KZ",
  });
  assert.deepEqual(h.c.meeting?.languages, ["ru", "kk"]);
  assert.equal(h.c.issues[0].translations?.kk?.title, "Тармақ KZ");
  assert.equal(certificate.snapshot?.issues[0].translations?.kk?.title, undefined);
  const draft = h.c.documents.find(item => item.name === "Проект протокола заседания")!;
  assert.equal(draft.snapshot?.issues[0].translations?.ru?.title, "Русский пункт");
  assert.equal(draft.snapshot?.issues[0].translations?.kk?.title, "Тармақ KZ");
  const signed = { reason: "Итог голосования", signed_chair: "on" };
  h.run("sign", "commission", signed);
  const protocol = h.c.documents.find(item => item.name === "Подписанный протокол заседания")!;
  for (const language of ["ru", "kk"] as const) {
    const html = renderToStaticMarkup(createElement(DocumentContent, { c: h.c, kind: "protocol", document: protocol, language }));
    assert.match(html, language === "ru" ? /Русский пункт/ : /Тармақ KZ/);
    assert.doesNotMatch(html, /Попытка подмены/);
  }
});

test("комментарий члена АК сохраняет оригинал; перевод заполняет рабочий орган", () => {
  const h = fixture("kk");
  h.c.status = "circulated";
  h.c.certificate = {
    languages: ["kk", "ru"],
    davgaArguments: "",
    memberPositions: [],
  };
  h.c.members = [
    {
      id: "chair",
      name: "Председатель комиссии",
      present: true,
      recused: false,
      reason: "",
    },
  ];
  h.c.votes = {
    p1: {
      yes: 1,
      no: 0,
      approved: true,
      chair: "chair",
      present: 1,
      eligible: 1,
      votes: { chair: "accept" },
      voteReasons: { chair: "Бастапқы түсініктеме" },
      voteReasonLanguages: { chair: "kk" },
    },
  };
  assert.throws(
    () => h.run("fill-meeting-certificate", "work"),
    /перевод комментария/,
  );
  h.run("fill-meeting-certificate", "work", {
    meetingCertificateComment_p1_chair: "Перевод комментария",
  });
  assert.equal(
    h.c.certificate?.memberPositions[0].comment,
    "Перевод комментария",
  );
  assert.equal(
    h.c.certificate?.memberPositions[0].commentKk,
    "Бастапқы түсініктеме",
  );
  assert.equal(h.c.votes?.p1.voteReasons?.chair, "Бастапқы түсініктеме");
});

test("история показывает изменения казахских доводов отдельно", async () => {
  const { ProtocolChanges } = await import("../components/ProtocolChanges");
  const html = renderToStaticMarkup(
    createElement(ProtocolChanges, {
      version: {
        languages: ["kk"],
        createdAt: "2026-11-04",
        author: "Исполнитель",
        rows: [
          {
            pointId: "p1",
            pointNumber: "1",
            memberId: "chair",
            memberName: "Председатель",
            vote: "accept",
            original: "",
            edited: "",
            originalKk: "Жұмыс органының (ҚР ҚМ ДАВГА) дәлелдері: Бұрын",
            editedKk: "Жұмыс органының (ҚР ҚМ ДАВГА) дәлелдері: Кейін",
          },
        ],
      },
      expanded: true,
    }),
  );
  assert.match(html, /Қазақша/);
  assert.match(html, /Бұрын/);
  assert.match(html.replace(/<[^>]+>/g, ""), /Кейін/);
});

test("черновик двуязычного ответа восстанавливается, другая языковая версия подписанного документа не создаётся", () => {
  const h = fixture("kk");
  h.c.requests[0].responseDraft = {
    savedAt: h.state.date,
    values: {
      authorityFinding_p1: "Черновик нарушения",
      authorityFindingKk_p1: "Бұзушылық жобасы",
    },
  };
  const html = renderToStaticMarkup(
    createElement(ActionModal, {
      c: h.c,
      action: "fill-request-response",
      role: "dvga",
      date: h.state.date,
      onClose() {},
      onSubmit() {},
      onSaveDraft() {},
    }),
  );
  assert.match(html, /Черновик нарушения/);
  assert.match(html, /Бұзушылық жобасы/);
  assert.match(html, /Сохранить черновик/);
  const document = {
    kind: "certificate",
    name: "Справка",
    text: "",
    author: "Исполнитель",
    date: h.state.date,
    languages: ["kk"] as DocumentLanguage[],
  };
  assert.equal(
    renderToStaticMarkup(
      createElement(DocumentContent, {
        c: h.c,
        kind: "certificate",
        document,
        language: "ru",
      }),
    ),
    "",
  );
});

test("принятые казахские правки попадают в проект и мотивированный ответ, исходный протокол сохраняется", () => {
  const h = fixture("kk");
  h.c.status = "decision_project";
  h.c.certificate = {
    languages: ["kk"],
    davgaArguments: "",
    davgaArgumentsByPointKk: { p1: "Анықтама KZ" },
    memberPositions: [],
  };
  h.c.meeting = {
    date: h.state.date,
    number: "ПЗ-09/2026-1",
    signed: h.state.date,
    audio: "",
    languages: ["kk"],
    protocolVersions: [
      {
        createdAt: h.state.date,
        author: "Исполнитель",
        signedAt: "2026-09-08T10:00:00Z",
        languages: ["kk"],
        rows: [
          {
            pointId: "p1",
            pointNumber: "1",
            memberId: "chair",
            memberName: "Председатель",
            vote: "accept",
            original: "",
            edited: "",
            originalKk: "Жұмыс органының (ҚР ҚМ ДАВГА) дәлелдері: Анықтама KZ",
            editedKk: "Жұмыс органының (ҚР ҚМ ДАВГА) дәлелдері: Хаттама KZ",
          },
        ],
      },
    ],
  };
  h.c.votes = {
    p1: {
      yes: 1,
      no: 0,
      approved: true,
      chair: "chair",
      present: 1,
      eligible: 1,
      votes: { chair: "accept" },
    },
  };
  h.c.issues[0].final = "accept";
  h.run("propose-certificate-change", "work", {
    proposedDavgaKk_p1: "Жобаға өзгеріс KZ",
  });
  assert.equal(
    h.c.certificateChangeRequests?.at(-1)?.changes[0].language,
    "kk",
  );
  h.run("review-certificate-change", "director", {
    decision_p1_kk: "accepted",
  });
  assert.equal(decisionProjectDavga(h.c, "p1", "kk"), "Жобаға өзгеріс KZ");
  assert.equal(
    h.c.certificate?.davgaArgumentsByPointKk?.p1,
    "Жобаға өзгеріс KZ",
  );
  h.run("create-decision-project", "work");
  h.run("approve-decision-project", "deputy");
  h.run("sign-decision-project", "director");
  const project = h.c.documents.at(-1)!;
  h.c.status = "decided";
  h.run("propose-certificate-change", "work", {
    proposedDavgaKk_p1: "Жауапқа өзгеріс KZ",
  });
  h.run("review-certificate-change", "director", {
    decision_p1_kk: "accepted",
  });
  h.run("deliver", "work", { motivatedResponseApplicantChannel: "saq" });
  const response = h.c.documents
    .filter((d) => d.kind === "final-response")
    .at(-1)!;
  const responseHtml = renderToStaticMarkup(
    createElement(DocumentContent, {
      c: h.c,
      kind: "final-response",
      document: response,
    }),
  );
  assert.match(responseHtml, /Жауапқа өзгеріс KZ/);
  const projectHtml = renderToStaticMarkup(
    createElement(DocumentContent, {
      c: h.c,
      kind: "decision-project",
      document: project,
    }),
  );
  assert.match(projectHtml, /Жобаға өзгеріс KZ/);
  assert.doesNotMatch(projectHtml, /Жауапқа өзгеріс KZ/);
  assert.match(
    h.c.meeting!.protocolVersions![0].rows[0].editedKk!,
    /Хаттама KZ/,
  );
});

for (const primary of ["ru", "kk"] as const) {
  test(`${primary}: перевод предмета закупки сохраняется в версии справки`, () => {
    const h = fixture(primary);
    h.c.status = "materials";
    h.c.appealType = "Жалоба на действие/бездействие";
    h.c.agendaDetails = { procurementNumber: "123", procurementSubject: primary === "ru" ? "Поставка оборудования" : "Жабдық жеткізу" };
    const other = primary === "ru" ? "kk" : "ru";
    const original = h.c.agendaDetails.procurementSubject;
    const editedOriginal = primary === "ru" ? "Исправленная поставка" : "Түзетілген жеткізу";
    const translation = primary === "ru" ? "Жабдық жеткізу" : "Поставка оборудования";
    const values = { documentLanguageMode: "both", pointTitle_ru_p1: "Вопрос RU", pointTitle_kk_p1: "Мәселе KZ", davgaArguments_p1: "Доводы RU", davgaArgumentsKk_p1: "Дәлелдер KZ", [`procurementSubject_${primary}`]: editedOriginal, [`procurementSubject_${other}`]: translation };
    const fields = actionForm("analysis", h.c, h.state.date, values).fields;
    assert.ok(fields.some(field => field.name === `procurementSubject_${other}` && field.language === other && field.required));
    assert.ok(actionForm("analysis", h.c, h.state.date, { documentLanguageMode: primary }).fields.some(field => field.name === `procurementSubject_${primary}` && field.value === original && !field.readOnly));
    assert.ok(!actionForm("analysis", h.c, h.state.date, { documentLanguageMode: primary }).fields.some(field => field.name === `procurementSubject_${other}`));
    const missing = { ...values, [`procurementSubject_${other}`]: "" };
    assert.throws(() => h.run("analysis", "work", missing), /перевод предмета государственной закупки/);
    h.run("analysis", "work", values);
    assert.equal(h.c.agendaDetails?.procurementSubject, original);
    const doc = h.c.documents.at(-1)!;
    assert.equal(doc.snapshot?.agendaDetails?.procurementSubjectTranslations?.[primary], editedOriginal);
    assert.equal(doc.snapshot?.agendaDetails?.procurementSubjectTranslations?.[other], translation);
    h.c.agendaDetails!.procurementSubjectTranslations![other] = "изменённый позже перевод";
    for (const language of [primary, other]) {
      const html = renderToStaticMarkup(createElement(DocumentContent, { c: h.c, kind: "certificate", document: doc, language }));
      assert.ok(html.includes(language === primary ? editedOriginal : translation));
      assert.ok(!html.includes("изменённый позже перевод"));
    }
  });
}

test("казахское обращение: перевод протокола сохраняется также в карточке", () => {
  const h = fixture("kk");
  h.c.status = "materials";
  h.run("analysis", "work", { documentLanguageMode: "kk", davgaArgumentsKk_p1: "Дәлел KZ" });
  h.c.status = "meeting";
  h.c.members = [{ id: "chair", name: "Председатель", present: true, recused: false, reason: "" }];
  const values = { documentLanguageMode: "both", pointTitle_ru_p1: "Перевод RU", protocolVote_p1_chair: "accept", protocolDavga_p1_chair: "RU", protocolDavgaKk_p1_chair: "KZ" };
  const fields = actionForm("vote", h.c, h.state.date, values).fields;
  assert.ok(fields.some(field => field.name === "pointTitle_ru_p1"));
  assert.ok(!fields.some(field => field.name === "pointTitle_kk_p1"));
  h.run("vote", "work", values);
  assert.equal(h.c.meeting?.protocolVersions?.at(-1)?.pointTitles?.p1?.ru, "Перевод RU");
  assert.equal(h.c.issues[0].translations?.ru?.title, "Перевод RU");
  h.run("return-protocol", "director", { returnComment: "Уточнить" });
  const returned = actionForm("vote", h.c, h.state.date, { documentLanguageMode: "both" }).fields;
  assert.equal(returned.find(field => field.name === "pointTitle_ru_p1")?.value, "Перевод RU");
});

for (const primary of ["ru", "kk"] as const) {
  test(`${primary}: можно сформировать справку и протокол только на другом языке`, () => {
    const h = fixture(primary);
    const other = primary === "ru" ? "kk" : "ru";
    const translated = other === "ru" ? "Описание на русском" : "Қазақша сипаттама";
    h.c.status = "materials";
    assert.throws(() => h.run("analysis", "work", { documentLanguageMode: other, [other === "ru" ? "davgaArguments_p1" : "davgaArgumentsKk_p1"]: "Доводы" }), /описание/);
    h.run("analysis", "work", { documentLanguageMode: other, [`pointTitle_${other}_p1`]: translated, [other === "ru" ? "davgaArguments_p1" : "davgaArgumentsKk_p1"]: "Доводы" });
    const cert = h.c.documents.at(-1)!;
    assert.deepEqual(cert.languages, [other]);
    assert.equal(h.c.issues[0].argument, primary === "ru" ? "Довод заявителя RU" : "Өтініш беруші KZ");
    assert.ok(renderToStaticMarkup(createElement(DocumentContent, { c: h.c, kind: "certificate", document: cert, language: other })).includes(translated));
    h.c.status = "meeting";
    h.c.members = [{ id: "chair", name: "Председатель", present: true, recused: false, reason: "" }];
    assert.equal(actionForm("vote", h.c, h.state.date, {}).fields.find(field => field.name === "documentLanguageMode")?.value, other);
    h.run("vote", "work", { documentLanguageMode: other, protocolVote_p1_chair: "accept", [other === "ru" ? "protocolDavga_p1_chair" : "protocolDavgaKk_p1_chair"]: "Доводы" });
    const protocol = h.c.documents.find(item => item.name === "Проект протокола заседания")!;
    assert.deepEqual(protocol.languages, [other]);
    assert.ok(renderToStaticMarkup(createElement(DocumentContent, { c: h.c, kind: "protocol", document: protocol, language: other })).includes(translated));
  });
}

for (const primary of ["ru", "kk"] as const) {
  test(`${primary}: перевод довода заявителя в справке сохраняется отдельно от оригинала`, () => {
    const h = fixture(primary);
    const other = primary === "ru" ? "kk" : "ru";
    const original = h.c.issues[0].argument;
    const translation = other === "ru" ? "Переведённый довод" : "Аударылған дәлел";
    h.c.status = "materials";
    const values = { documentLanguageMode: "both", [`pointTitle_${other}_p1`]: "Перевод описания", davgaArguments_p1: "Доводы RU", davgaArgumentsKk_p1: "Дәлел KZ", [`certificateArgumentTranslation_${other}_p1`]: translation };
    const fields = actionForm("analysis", h.c, h.state.date, values).fields;
    assert.ok(fields.some(field => field.name === `certificateArgumentTranslation_${other}_p1` && field.required === false && !field.readOnly));
    assert.ok(!fields.some(field => field.name === `certificateArgumentTranslation_${primary}_p1`));
    h.c.analysisDraft = { values, savedAt: h.state.date };
    const modal = renderToStaticMarkup(createElement(ActionModal, { c: h.c, action: "analysis", role: "work", date: h.state.date, onClose() {}, onSubmit() {} }));
    assert.ok(modal.includes(translation));
    h.run("analysis", "work", values);
    const document = h.c.documents.at(-1)!;
    assert.equal(h.c.issues[0].argument, original);
    assert.equal(document.snapshot?.issues[0].certificateArgumentTranslations?.[other], translation);
    assert.ok(renderToStaticMarkup(createElement(DocumentContent, { c: h.c, kind: "certificate", document, language: primary })).includes(original));
    assert.ok(renderToStaticMarkup(createElement(DocumentContent, { c: h.c, kind: "certificate", document, language: other })).includes(translation));
    h.c.issues[0].certificateArgumentTranslations![other] = "Более позднее изменение";
    assert.ok(renderToStaticMarkup(createElement(DocumentContent, { c: h.c, kind: "certificate", document, language: other })).includes(translation));
    const withoutTranslation = structuredClone(document);
    delete withoutTranslation.snapshot!.issues[0].certificateArgumentTranslations;
    assert.ok(renderToStaticMarkup(createElement(DocumentContent, { c: h.c, kind: "certificate", document: withoutTranslation, language: other })).includes(original));
  });
}

for (const primary of ["ru", "kk"] as const) {
  test(`${primary}: перевод содержания заявления сохраняется в версии справки`, () => {
    const h = fixture(primary);
    h.c.status = "materials";
    h.c.appealType = "Заявление";
    const original = primary === "ru" ? "О пересмотре решения" : "Шешімді қайта қарау туралы";
    const translation = primary === "ru" ? "Шешімді қайта қарау туралы" : "О пересмотре решения";
    const other = primary === "ru" ? "kk" : "ru";
    h.c.request = original;
    const values = { documentLanguageMode: "both", [`pointTitle_${other}_p1`]: "Перевод пункта", davgaArguments_p1: "Доводы RU", davgaArgumentsKk_p1: "Дәлел KZ", [`statementTranslation_${other}`]: translation };
    const field = actionForm("analysis", h.c, h.state.date, values).fields.find(item => item.name === `statementTranslation_${other}`);
    assert.ok(field && !field.readOnly && !field.required && field.language === other);
    assert.ok(!actionForm("analysis", h.c, h.state.date, { documentLanguageMode: primary }).fields.some(item => item.name.startsWith("statementTranslation_")));
    h.c.analysisDraft = { values, savedAt: h.state.date };
    const modal = renderToStaticMarkup(createElement(ActionModal, { c: h.c, action: "analysis", role: "work", date: h.state.date, onClose() {}, onSubmit() {} }));
    assert.ok(modal.includes(translation));
    h.run("analysis", "work", values);
    const document = h.c.documents.at(-1)!;
    assert.equal(h.c.request, original);
    assert.equal(document.snapshot?.statementTranslations?.[other], translation);
    assert.ok(renderToStaticMarkup(createElement(DocumentContent, { c: h.c, kind: "certificate", document, language: primary })).includes(original));
    assert.ok(renderToStaticMarkup(createElement(DocumentContent, { c: h.c, kind: "certificate", document, language: other })).includes(translation));
    h.c.request = "Позднее изменение оригинала";
    h.c.statementTranslations![other] = "Позднее изменение перевода";
    assert.ok(renderToStaticMarkup(createElement(DocumentContent, { c: h.c, kind: "certificate", document, language: other })).includes(translation));
    const withoutTranslation = structuredClone(document);
    delete withoutTranslation.snapshot!.statementTranslations;
    assert.ok(renderToStaticMarkup(createElement(DocumentContent, { c: h.c, kind: "certificate", document: withoutTranslation, language: other })).includes(original));
  });
}

for (const primary of ["ru", "kk"] as const) for (const translatedInCertificate of [false, true]) {
  test(`${primary}: протокол использует перевод содержания заявления ${translatedInCertificate ? "из справки" : "из формы протокола"}`, () => {
    const h = fixture(primary);
    const other = primary === "ru" ? "kk" : "ru";
    const original = primary === "ru" ? "Заявление на русском" : "Қазақша өтініш";
    const translation = other === "ru" ? "Переведённое заявление" : "Аударылған өтініш";
    h.c.status = "materials";
    h.c.appealType = "Заявление";
    h.c.request = original;
    const certValues = { documentLanguageMode: "both", [`pointTitle_${other}_p1`]: "Перевод вопроса", davgaArguments_p1: "Доводы RU", davgaArgumentsKk_p1: "Дәлел KZ", ...(translatedInCertificate ? { [`statementTranslation_${other}`]: translation } : {}) };
    h.run("analysis", "work", certValues);
    const certificate = h.c.documents.at(-1)!;
    h.c.status = "meeting";
    h.c.members = [{ id: "chair", name: "Председатель", present: true, recused: false, reason: "" }];
    const values = { documentLanguageMode: "both", protocolVote_p1_chair: "accept", protocolDavga_p1_chair: "Доводы RU", protocolDavgaKk_p1_chair: "Дәлел KZ", ...(!translatedInCertificate ? { [`statementTranslation_${other}`]: translation } : {}) };
    const field = actionForm("vote", h.c, h.state.date, values).fields.find(item => item.name === `statementTranslation_${other}`);
    assert.equal(Boolean(field), !translatedInCertificate);
    if (field) {
      assert.equal(field.required, false);
      const modal = renderToStaticMarkup(createElement(ActionModal, { c: h.c, action: "vote", role: "work", date: h.state.date, onClose() {}, onSubmit() {} }));
      assert.ok(modal.indexOf("Участники заседания и результаты голосования") < modal.indexOf("Перевод поля «О чем заявление»"));
    }
    h.run("vote", "work", values);
    if (!translatedInCertificate) {
      h.run("return-protocol", "director", { returnComment: "Доработать" });
      assert.equal(actionForm("vote", h.c, h.state.date, { documentLanguageMode: "both" }).fields.find(item => item.name === `statementTranslation_${other}`)?.value, translation);
      h.run("vote", "work", values);
    }
    assert.equal(h.c.statementTranslations?.[other], translation);
    assert.equal(certificate.snapshot?.statementTranslations?.[other] || "", translatedInCertificate ? translation : "");
    const draft = h.c.documents.find(item => item.name === "Проект протокола заседания")!;
    assert.equal(draft.snapshot?.statementTranslations?.[other], translation);
    assert.ok(renderToStaticMarkup(createElement(DocumentContent, { c: h.c, kind: "protocol", document: draft, language: primary })).includes(original));
    assert.ok(renderToStaticMarkup(createElement(DocumentContent, { c: h.c, kind: "protocol", document: draft, language: other })).includes(translation));
    h.run("sign", "commission", { reason: "Решение", signed_chair: "on" });
    const signed = h.c.documents.find(item => item.name === "Подписанный протокол заседания")!;
    h.c.statementTranslations = { [other]: "Изменённый перевод" };
    assert.ok(renderToStaticMarkup(createElement(DocumentContent, { c: h.c, kind: "protocol", document: signed, language: other })).includes(translation));
  });
}

test("наименование заявителя сохраняется по языкам и фиксируется в версии справки", () => {
  const h = fixture("ru");
  h.c.org = "Организация RU";
  h.c.status = "materials";
  const values = { documentLanguageMode: "both", pointTitle_kk_p1: "Даулы мәселе", davgaArguments_p1: "Доводы RU", davgaArgumentsKk_p1: "Дәлелдер KZ", applicantName_kk: "Ұйым KZ" };
  const field = actionForm("analysis", h.c, h.state.date, values).fields.find(item => item.name === "applicantName_kk");
  assert.ok(field?.required);
  h.run("analysis", "work", values);
  assert.equal(h.c.orgTranslations?.kk, "Ұйым KZ");
  const doc = h.c.documents.at(-1)!;
  assert.equal(doc.snapshot?.orgTranslations?.kk, "Ұйым KZ");
  assert.equal(localizedCase(h.c, "ru").org, "Организация RU");
  assert.equal(localizedCase(h.c, "kk").org, "Ұйым KZ");
  h.c.orgTranslations!.kk = "Позднее название";
  const html = renderToStaticMarkup(createElement(DocumentContent, { c: h.c, kind: "certificate", document: doc, language: "kk" }));
  assert.match(html, /Ұйым KZ/);
  assert.doesNotMatch(html, /Позднее название/);
});
