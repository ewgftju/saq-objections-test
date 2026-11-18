import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createDemoRepository,
  initialState,
} from "../../../api/objectionsRepository";
import type { SubjectAppealDraft } from "../../../types";
import CasesList from "../pages/CasesList";
import { caseVisibleToRole } from "../services/caseVisibility";
import {
  createSubjectAppealDraft,
  MAX_APPEAL_FILE_SIZE,
  reportFingerprint,
  saveSubjectAppealDraft,
  subjectAuditReports,
  submitSubjectAppeal,
} from "../services/subjectAppeals";
import {
  SubjectAppealDocument,
  subjectAppealHtml,
} from "../components/SubjectAppealDocument";
import { DocumentContent } from "../components/DocumentModal";
import SubjectAppealForm from "../components/SubjectAppealForm";

function fixture() {
  const state = initialState();
  const source = state.cases.find(
    (c) => c.type === "audit" && c.bin === "001002003004",
  )!;
  source.document.number = "FIXTURE-АО";
  source.issues.push({
    id: "another-report-point",
    number: "12",
    title: "Неоспариваемое нарушение",
    finding: "Вывод из отчёта",
    argument: "Старый довод из другого обращения",
    amount: 100,
    disputed: false,
  });
  source.issues[0].translations = { kk: { title: "Есептің төртінші тармағы" } };
  source.issues[0].auditProgramResult = {
    number: "4",
    name: source.issues[0].title,
    answer:
      "Ответ на вопрос программы аудита: подтверждающие документы не представлены.",
    language: "ru",
    translations: {
      kk: {
        name: "Есептің төртінші тармағы",
        answer:
          "Аудит бағдарламасының сұрағына жауап: растайтын құжаттар ұсынылмаған.",
      },
    },
  };
  source.orgTranslations = { ru: source.org, kk: "«Аудит» ЖШС" };
  const report = subjectAuditReports(state.cases, "subject2")[0];
  const draft: SubjectAppealDraft = {
    ...createSubjectAppealDraft(report, "submitted-draft"),
    circumstances: "Договор был представлен до завершения аудита.",
    signerName: "Тестов Тест Тестович",
    selectedPointIds: [report.points[0].id],
    argumentsByPoint: {
      [report.points[0].id]: "Не согласен с выводом по пункту 4.",
    },
    attachments: [
      {
        id: "proof-1",
        name: "Договор.docx",
        size: 5,
        dataUrl: "data:application/octet-stream;base64,aGVsbG8=",
        pointId: report.points[0].id,
      },
    ],
  };
  return { state, source, report, draft };
}

test("кнопка подачи есть только у объекта №2, существующие кабинеты не меняются", () => {
  for (const role of [
    "subject2",
    "subject",
    "work",
    "dvga",
    "commission",
  ] as const) {
    const html = renderToStaticMarkup(
      createElement(CasesList, {
        cases: [],
        date: "2026-09-08",
        role,
        onOpen() {},
        onCreate() {},
        onExport() {},
        onCreateSubjectAppeal() {},
      }),
    );
    assert.equal(html.includes(">Подать обращение<"), role === "subject2");
  }
});

test("источник содержит только отчёты своего объекта, включая неоспариваемые пункты", () => {
  const { state, source, report } = fixture();
  assert.equal(subjectAuditReports(state.cases, "work").length, 0);
  assert.equal(report.number, source.document.number);
  assert.equal(report.points.at(-1)?.number, "12");
  assert.ok(
    report.points.every(
      (point) => !("argument" in point) && !("analysis" in point),
    ),
  );
  state.cases.push({
    ...structuredClone(source),
    id: "foreign",
    bin: "999999999999",
    document: { ...source.document, number: "FOREIGN" },
  });
  assert.ok(
    subjectAuditReports(state.cases, "subject2").every(
      (r) => r.bin === "001002003004",
    ),
  );
});

test("сохранение и повторная загрузка черновика не регистрируют обращение", () => {
  const { state, report } = fixture();
  const partial = createSubjectAppealDraft(report, "draft-only");
  partial.circumstances = "Незаконченный текст";
  const saved = saveSubjectAppealDraft(state, partial, "subject2");
  assert.equal(saved.cases.length, state.cases.length);
  const values = new Map<string, string>();
  const repo = createDemoRepository({
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  });
  repo.save(saved);
  assert.equal(
    repo.load().subjectAppealDrafts?.[0].circumstances,
    "Незаконченный текст",
  );
  assert.equal(state.subjectAppealDrafts, undefined);
});

test("подача переносит выбранные пункты и файлы, сохраняет снимок, направляет директору", () => {
  const { state, source, report, draft } = fixture();
  const result = submitSubjectAppeal(state, draft, "subject2");
  const c = result.state.cases.find((item) => item.id === result.caseId)!;
  assert.equal(c.channel, "SAQ");
  assert.equal(c.status, "received");
  assert.equal(c.assignee, "Не назначен");
  assert.equal(c.unread, true);
  assert.equal(caseVisibleToRole(c, "work"), false);
  assert.equal(caseVisibleToRole(c, "director"), true);
  assert.equal(c.document.number, source.document.number);
  assert.deepEqual(
    c.issues.map((point) => point.number),
    ["4"],
  );
  assert.equal(
    c.issues[0].authorityFinding,
    report.points[0].auditProgramResult?.answer,
  );
  assert.equal(c.issues[0].evidence, "Договор.docx");
  assert.equal(c.subjectAppeal?.draft.circumstances, draft.circumstances);
  assert.notEqual(c.request, draft.circumstances);
  assert.equal(c.documents.filter((document) => document.dataUrl).length, 1);
  assert.ok(
    result.state.notifications.some(
      (n) => n.recipientRole === "director" && n.caseId === c.id,
    ),
  );
  source.issues[0].title = "Исправленный исходник";
  draft.circumstances = "Изменённый черновик";
  assert.notEqual(
    c.subjectAppeal?.report.points[0].title,
    source.issues[0].title,
  );
  assert.notEqual(c.subjectAppeal?.draft.circumstances, draft.circumstances);
});

test("повторная отправка одной подписанной версии возвращает прежний номер", () => {
  const { state, draft } = fixture();
  const once = submitSubjectAppeal(state, draft, "subject2");
  const twice = submitSubjectAppeal(once.state, draft, "subject2");
  assert.equal(twice.caseId, once.caseId);
  assert.equal(twice.state.cases.length, state.cases.length + 1);
  assert.equal(
    subjectAuditReports(twice.state.cases, "subject2").length,
    subjectAuditReports(state.cases, "subject2").length,
  );
});

test("чужая роль, чужой отчёт, неизвестный пункт и изменённый источник не принимаются", () => {
  const { state, draft } = fixture();
  assert.throws(
    () => submitSubjectAppeal(state, draft, "subject"),
    /кабинете объекта/,
  );
  assert.throws(
    () =>
      submitSubjectAppeal(
        state,
        { ...draft, sourceCaseId: "чужой" },
        "subject2",
      ),
    /Отчёт недоступен/,
  );
  assert.throws(
    () =>
      submitSubjectAppeal(
        state,
        { ...draft, selectedPointIds: ["несуществующий"] },
        "subject2",
      ),
    /которого нет/,
  );
  state.cases.find((c) => c.id === draft.sourceCaseId)!.document.number =
    "Изменённый отчёт";
  assert.throws(
    () => submitSubjectAppeal(state, draft, "subject2"),
    /изменились/,
  );
});

test("обстоятельства обязательны по каждому пункту; общее поле не требуется; размер доказательства проверяется", () => {
  const { state, draft } = fixture();
  const submitted = submitSubjectAppeal(state, { ...draft, circumstances: "" }, "subject2").state.cases[0];
  assert.equal(submitted.issues[0].argument, draft.argumentsByPoint[draft.selectedPointIds[0]]);
  assert.throws(
    () =>
      submitSubjectAppeal(
        state,
        { ...draft, argumentsByPoint: {} },
        "subject2",
      ),
    /пункту № 4/,
  );
  assert.throws(
    () =>
      submitSubjectAppeal(
        state,
        { ...draft, selectedPointIds: [] },
        "subject2",
      ),
    /хотя бы один/,
  );
  assert.throws(
    () =>
      submitSubjectAppeal(
        state,
        {
          ...draft,
          attachments: [
            { ...draft.attachments[0], size: MAX_APPEAL_FILE_SIZE + 1 },
          ],
        },
        "subject2",
      ),
    /до 2 МБ/,
  );
});

test("печатная форма выводит пять разделов, приложение по пунктам и названия файлов на нужном языке", () => {
  const { report, draft } = fixture();
  draft.language = "kk";
  draft.argumentsByPoint[draft.selectedPointIds[0]] = '<script>alert("x")</script>';
  const html = subjectAppealHtml(report, draft, "2026-09-08");
  assert.match(html, /Қарсылық/);
  assert.match(html, /Мемлекеттік аудит жүргізген/);
  assert.match(html, /Атырау облысы/);
  assert.match(html, /Есептің төртінші тармағы/);
  assert.match(html, /растайтын құжаттар ұсынылмаған/);
  assert.match(html, /Договор.docx/);
  assert.match(html, /Қоса берілетін құжаттардың тізбесі/);
  assert.match(html, /&lt;script&gt;/);
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("Неоспариваемое нарушение"));
  assert.ok(!html.includes("Старый довод"));
  assert.equal(reportFingerprint(report), draft.sourceFingerprint);
});

test("директор открывает ту же поданную форму, без повторного создания документа", () => {
  const { state, draft } = fixture();
  const submitted = submitSubjectAppeal(state, draft, "subject2");
  const c = submitted.state.cases[0];
  const html = renderToStaticMarkup(
    createElement(DocumentContent, { c, kind: "original" }),
  );
  const expected = renderToStaticMarkup(
    createElement(SubjectAppealDocument, {
      report: c.subjectAppeal!.report,
      draft: c.subjectAppeal!.draft,
      date: state.date,
      submitted: true,
    }),
  );
  assert.equal(html, expected);
});

test("номер, наименование и ответ берутся из результата программы аудита, а не из старых реквизитов пункта", () => {
  const { state, source, draft } = fixture();
  const point = source.issues[0];
  point.number = "Старый номер";
  point.title = "Старое описание";
  point.finding = "Документ, подтверждающий нарушение.pdf";
  point.authorityFinding = "Ответ органа аудита на запрос";
  point.auditProgramResult!.number = "4.2";
  point.auditProgramResult!.name = "Проверка исполнения договора";
  const report = subjectAuditReports(state.cases, "subject2")[0];
  draft.sourceFingerprint = reportFingerprint(report);
  const submitted = submitSubjectAppeal(state, draft, "subject2").state
    .cases[0];
  assert.equal(submitted.issues[0].number, "4.2");
  assert.equal(submitted.issues[0].title, "Проверка исполнения договора");
  assert.equal(
    submitted.issues[0].authorityFinding,
    point.auditProgramResult!.answer,
  );
  assert.equal(submitted.issues[0].finding, point.finding);
  point.auditProgramResult!.answer = "Позднее изменение исходного отчёта";
  assert.notEqual(
    submitted.subjectAppeal!.report.points[0].auditProgramResult!.answer,
    point.auditProgramResult!.answer,
  );
});

test("при отсутствии ответа отчёта нарушение не заменяется названием вопроса, доказательством или внутренним ответом органа", () => {
  const { state, source, draft } = fixture();
  delete source.issues[0].auditProgramResult;
  source.issues[0].finding = "Доказательство.pdf";
  source.issues[0].authorityFinding = "Внутренний ответ органа";
  const report = subjectAuditReports(state.cases, "subject2")[0];
  draft.sourceFingerprint = reportFingerprint(report);
  const submitted = submitSubjectAppeal(state, draft, "subject2").state
    .cases[0];
  assert.equal(submitted.issues[0].authorityFinding, "");
  assert.equal(submitted.issues[0].auditProgramResult, undefined);
});

test("приложение к запросу сохраняет ответ из исходного отчёта после ответа органа", () => {
  const { state, draft } = fixture();
  const c = submitSubjectAppeal(state, draft, "subject2").state.cases[0];
  c.issues[0].authorityFinding = "Новый текст от органа аудита";
  const html = renderToStaticMarkup(
    createElement(DocumentContent, { c, kind: "request-appendix" }),
  );
  assert.match(html, /подтверждающие документы не представлены/);
  assert.ok(!html.includes("Новый текст от органа аудита"));
});

test("поданная форма без результата программы аудита сохраняет прежние колонки", () => {
  const { report, draft } = fixture();
  delete report.points[0].auditProgramResult;
  const html = subjectAppealHtml(report, draft, "2026-09-08", true);
  assert.ok(
    !html.includes("<th>Нарушение, по которому поступило возражение</th>"),
  );
  assert.match(html, /Описание оспариваемого вопроса/);
});

test("в тестовом отчёте 1-АО доступны два результата без изменения существующих обращений", () => {
  const state = initialState();
  const originalCases = structuredClone(state.cases);
  const report = subjectAuditReports(state.cases, "subject2").find(
    (item) => item.number === "1-АО",
  )!;
  assert.deepEqual(report.points.map((point) => [point.number, point.title]), [
    ["1", "Представительские расходы"],
    ["2", "Контроль приобретения, хранение и списание продуктов питания, медикаментов и мягкого инвентаря в сфере образования"],
  ]);
  assert.equal(report.points[0].auditProgramResult?.answer,
    Array(5).fill("Расходы выявленные представителями были там то там то тестово направлены и сгенерированы.").join(" "));
  assert.equal(report.points[1].auditProgramResult?.answer,
    Array(4).fill("Ответ был тестовый нарушение не выявлены в части теста.").join(" "));
  assert.deepEqual(state.cases, originalCases);
  const repo = createDemoRepository({
    getItem: () => JSON.stringify(state),
    setItem() {},
  });
  assert.deepEqual(subjectAuditReports(repo.load().cases, "subject2").find(
    (item) => item.number === "1-АО",
  ), report);

  const draft = {
    ...createSubjectAppealDraft(report, "test-results"),
    circumstances: "Тестовые обстоятельства",
    signerName: "Тестовый подписант",
    selectedPointIds: report.points.map((point) => point.id),
    argumentsByPoint: Object.fromEntries(report.points.map((point) => [point.id, "Обоснование № " + point.number])),
  };
  const submitted = submitSubjectAppeal(state, draft, "subject2").state.cases[0];
  assert.deepEqual(submitted.issues.map((point) => [point.number, point.title, point.authorityFinding, point.argument]),
    report.points.map((point) => [point.number, point.title, point.auditProgramResult!.answer, draft.argumentsByPoint[point.id]]));
  assert.deepEqual(submitted.subjectAppeal?.report, report);
});

test("старые поданные формы сохраняют перечень названий файлов и доводы заявителя", () => {
  const { report, draft } = fixture();
  delete draft.documentList;
  draft.attachments.push({ ...draft.attachments[0], id: "general-proof", name: "Общее доказательство.pdf", pointId: undefined });
  for (const language of ["ru", "kk"] as const) {
    draft.language = language;
    const html = subjectAppealHtml(report, draft, "2026-09-08", true);
    const manifest = html.match(/<ol class="subject-appeal-manifest">(.*?)<\/ol>/s)![1];
    assert.equal(manifest, "<li>Договор.docx</li><li>Общее доказательство.pdf</li>");
    assert.ok(html.includes(draft.argumentsByPoint[report.points[0].id]));
    assert.ok(html.includes(language === "ru" ? "Обстоятельства, на которые объект государственного аудита, подающий возражение, основывает свои требования, и доказательства, подтверждающие эти обстоятельства" : "Қарсылық беруші мемлекеттік аудит объектісі өз талаптарын негіздейтін мән-жайлар және осы мән-жайларды растайтын дәлелдемелер"));
  }
  draft.attachments = [];
  const emptyManifest = subjectAppealHtml(report, draft, "2026-09-08", true).match(/<ol class="subject-appeal-manifest">(.*?)<\/ol>/s)![1];
  assert.equal(emptyManifest, "");
});

test("в редакторе нет общего поля обстоятельств; по каждому пункту остаётся переименованный ввод довода и документов", () => {
  const { state, draft } = fixture();
  state.subjectAppealDrafts = [draft];
  const html = renderToStaticMarkup(createElement(SubjectAppealForm, {
    state, role: "subject2", draftId: draft.id, onClose() {}, onSave() {}, onSubmit() {},
  }));
  const argument = html.indexOf("Обстоятельства, на которые объект государственного аудита, подающий возражение, основывает свои требования, и доказательства, подтверждающие эти обстоятельства");
  const documents = html.indexOf("5. Перечень прилагаемых документов");
  const list = html.indexOf('aria-label="Перечень прилагаемых документов"');
  assert.ok(argument > 0 && argument < documents && documents < list);
  assert.equal((html.match(/<textarea/g) || []).length, draft.selectedPointIds.length + 1);
  assert.equal((html.match(/type="file"/g) || []).length, draft.selectedPointIds.length);
  assert.ok(!html.includes("Файлы доказательств к обращению"));
  assert.ok(!html.includes("Перечень формируется из названий"));
  assert.ok(!html.includes('aria-label="Обстоятельства"'));
  assert.ok(!html.includes("Обоснование (довод заявителя)"));
  assert.ok(html.includes("Документы, подтверждающие обстоятельства, на которых объект государственного аудита основывает свои требования, документы, имеющие отношение к возражению"));
});

test("новая поданная форма и предпросмотр используют обстоятельства по пунктам; старые поданные формы сохраняют общее поле", () => {
  const { state, report, draft } = fixture();
  const originalCircumstances = draft.circumstances;
  const pointId = draft.selectedPointIds[0];
  draft.circumstances = "";
  const submitted = submitSubjectAppeal(state, draft, "subject2").state.cases[0];
  assert.equal(submitted.issues[0].argument, draft.argumentsByPoint[pointId]);
  assert.equal(submitted.subjectAppeal!.draft.circumstancesMode, "per-point");
  assert.ok(submitted.documents[0].text.includes(draft.argumentsByPoint[pointId]));
  for (const signed of [false, true]) {
    const html = subjectAppealHtml(report, submitted.subjectAppeal!.draft, state.date, signed);
    assert.ok(!html.includes("4. Обстоятельства,"));
    assert.ok(html.includes(draft.argumentsByPoint[pointId]));
    assert.ok(html.indexOf("Доводы по оспариваемым вопросам") < html.indexOf("5. Перечень прилагаемых документов"));
  }
  draft.circumstances = originalCircumstances;
  delete draft.circumstancesMode;
  const legacy = subjectAppealHtml(report, draft, state.date, true);
  assert.ok(legacy.includes(originalCircumstances));
  assert.ok(legacy.includes(draft.argumentsByPoint[pointId]));
});

test("ручной перечень сохраняется в черновике и поданной форме и выводится без автоподстановки файлов", () => {
  const { state, report, draft } = fixture();
  draft.documentList = "1. Пояснения к расчёту — 2 листа.\n2. Копия договора <версия 1>.";
  const saved = saveSubjectAppealDraft(state, draft, "subject2");
  let stored = "";
  const repo = createDemoRepository({
    getItem: () => stored || null,
    setItem(_key, value) { stored = value; },
  });
  repo.save(saved);
  const reloaded = repo.load();
  const restoredDraft = reloaded.subjectAppealDrafts![0];
  assert.equal(restoredDraft.documentList, draft.documentList);
  const submitted = submitSubjectAppeal(reloaded, restoredDraft, "subject2").state.cases[0];
  assert.equal(submitted.subjectAppeal!.draft.documentList, draft.documentList);
  assert.equal(submitted.documents.filter((document) => document.dataUrl).length, draft.attachments.length);
  for (const language of ["ru", "kk"] as const) {
    for (const signed of [false, true]) {
      const html = subjectAppealHtml(report, { ...submitted.subjectAppeal!.draft, language }, state.date, signed);
      const section = html.slice(html.indexOf("5. "), html.indexOf('class="subject-appeal-signature"'));
      assert.ok(section.includes("1. Пояснения к расчёту — 2 листа.\n2. Копия договора &lt;версия 1&gt;."));
      assert.ok(!section.includes("Договор.docx"));
      assert.ok(!section.includes('type="file"'));
      assert.ok(!section.includes("subject-appeal-manifest"));
    }
  }
});
