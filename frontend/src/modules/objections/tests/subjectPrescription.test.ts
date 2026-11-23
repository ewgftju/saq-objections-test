import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState } from "../../../api/objectionsRepository";
import type { Role } from "../../../types";
import { DEMO_SUBJECT_PRESCRIPTION } from "../../../data/subjectPrescription";
import SubjectPrescriptionForm from "../components/SubjectPrescriptionForm";
import SubjectAppealStart from "../components/SubjectAppealStart";
import { subjectAppealHtml } from "../components/SubjectAppealDocument";
import { DocumentContent } from "../components/DocumentModal";
import CaseWorkspace from "../pages/CaseWorkspace";
import { actionForm } from "../formDefinitions";
import {
  createSubjectAppealDraft,
  saveSubjectAppealDraft,
  submitSubjectAppeal,
} from "../services/subjectAppeals";
import {
  subjectPrescriptions,
  saveSubjectIssueDescription,
} from "../services/subjectPrescriptions";
import { caseVisibleToRole } from "../services/caseVisibility";
import { addWorkdays, reviewDeadline, executionDeadline } from "../services/deadlines";

function fixture(language: "ru" | "kk" = "ru") {
  const state = initialState();
  state.date = "2026-11-19";
  const source = subjectPrescriptions(state, "subject2")[0];
  const draft = createSubjectAppealDraft(source, "prescription-draft");
  draft.language = language;
  draft.signerName = "Тестовый подписант";
  draft.selectedPointIds = source.points.map((p) => p.id);
  draft.argumentsByPoint = Object.fromEntries(
    source.points.map((p) => [p.id, `Довод ${p.number}`]),
  );
  draft.attachments = source.points.map((point) => ({
      id: "proof-" + point.id,
      name: `Доказательство ${point.number}.pdf`,
      size: 1,
      dataUrl: "data:application/pdf;base64,YQ==",
      pointId: point.id,
    }));
  return { state, source, draft };
}

test("заглушка предписания содержит пять двуязычных нарушений и пустые описания", () => {
  const { state, source } = fixture();
  assert.equal(source.number, "ПнУН-30101-26-000072/50002");
  assert.equal(source.date, "2026-11-17");
  assert.equal(source.points.length, 5);
  assert.deepEqual(source.relatedAuditReport, {
    number: "1-АО",
    date: "2026-09-05",
  });
  assert.deepEqual(
    source.points.map((p) => p.number),
    ["1", "2", "3", "4", "5"],
  );
  for (const p of source.points) {
    assert.equal(p.title, "");
    assert.equal(p.titleRu, undefined);
    assert.equal(p.titleKk, undefined);
    assert.equal(p.auditProgramResult, undefined);
    assert.ok(p.prescriptionText?.ru);
    assert.ok(p.prescriptionText?.kk);
  }
  assert.equal(
    source.points[0].prescriptionText?.ru,
    "возместить (перечислить) в бюджет сумму 0 тыс. тенге на код бюджетной классификации –;",
  );
  assert.equal(
    source.points[4].prescriptionText?.kk,
    "анықталған бұзушылықтарға жол берген лауазымды адамдардың тәртіптік жауапкершілігін қарау: –.",
  );
  assert.equal(
    state.cases.some((c) => c.document.number === source.number),
    false,
  );
  for (const role of ["subject", "work", "director", "dvga", "kvga"] as Role[])
    assert.equal(subjectPrescriptions(state, role).length, 0);
  assert.equal(
    subjectPrescriptions({ ...state, subjectPrescriptions: [] }, "subject2")
      .length,
    0,
  );
  assert.equal(
    subjectPrescriptions(
      { ...state, subjectPrescriptions: [{ ...source, available: false }] },
      "subject2",
    ).length,
    0,
  );
});

test("жалоба отправляется с пустыми описаниями, правильным видом, реквизитами и нарушениями на выбранном языке", () => {
  for (const language of ["ru", "kk"] as const) {
    const { state, source, draft } = fixture(language);
    const before = structuredClone(state);
    const submitted = submitSubjectAppeal(state, draft, "subject2");
    const c = submitted.state.cases[0];
    assert.match(c.id, /^Ж-2026-/);
    assert.equal(c.type, "control");
    assert.equal(c.appealType, "Жалоба на решение КВГА/ДВГА");
    assert.equal(c.agendaDetails?.decisionKind, "prescription-audit");
    assert.equal(c.document.name, "Предписание");
    assert.equal(c.document.number, source.number);
    assert.equal(c.document.date, "2026-11-17");
    assert.equal(c.agendaDetails?.relatedDocumentNumber, "1-АО");
    assert.equal(c.agendaDetails?.relatedDocumentDate, "2026-09-05");
    assert.deepEqual(
      c.issues.map((p) => p.title),
      ["", "", "", "", ""],
    );
    assert.deepEqual(
      c.issues.map((p) => p.authorityFinding),
      source.points.map((p) => p.prescriptionText?.[language]),
    );
    assert.equal(c.issues[0].evidence, "Доказательство 1.pdf");
    assert.equal(c.issues[1].evidence, "Доказательство 2.pdf");
    assert.equal(c.status, "received");
    assert.equal(reviewDeadline(c), addWorkdays(state.date, 20));
    assert.equal(executionDeadline(c, "director"), state.date);
    assert.equal(caseVisibleToRole(c, "work"), false);
    assert.equal(caseVisibleToRole(c, "director"), true);
    assert.equal(caseVisibleToRole(c, "subject2"), true);
    assert.ok(
      submitted.state.notifications.some(
        (n) => n.caseId === c.id && n.recipientRole === "director",
      ),
    );
    assert.deepEqual(c.subjectAppeal?.report, source);
    assert.deepEqual(state, before);
    assert.deepEqual(subjectPrescriptions(submitted.state, "subject2"), subjectPrescriptions(state, "subject2"));
    assert.equal(
      submitSubjectAppeal(submitted.state, draft, "subject2").caseId,
      c.id,
    );
    const html = subjectAppealHtml(source, draft, state.date, true);
    assert.ok(html.includes(language === "ru" ? "Жалоба" : "Шағым"));
    assert.ok(html.includes(source.number));
    assert.ok(html.includes("17.11.2026"));
    assert.ok(html.includes("1-АО"));
    const blocks = [...html.matchAll(/<div class="subject-appeal-argument">(.*?)<\/div>/gs)].map(match => match[1]);
    assert.equal(blocks.length, source.points.length);
    source.points.forEach((point, index) => {
      assert.ok(blocks[index].includes(language === "ru" ? `По пункту № ${point.number}:` : `№ ${point.number} тармақ бойынша:`));
      assert.ok(blocks[index].includes(draft.argumentsByPoint[point.id]));
      assert.ok(blocks[index].includes(language === "ru" ? "Документы, подтверждающие обстоятельства:" : "Мән-жайларды растайтын құжаттар:"));
      assert.deepEqual([...blocks[index].matchAll(/<li>(.*?)<\/li>/gs)].map(match => match[1]), [`Доказательство ${point.number}.pdf`]);
      assert.ok(!blocks[index].includes(point.prescriptionText![language]!));
      assert.doesNotMatch(blocks[index], /<h5>Довод заявителя|<h5>Өтініш берушінің уәжі/);
    });
    assert.doesNotMatch(html, /<b>(Нарушение:|Бұзушылық:)<\/b>/);
  }
});

for (const language of ["ru", "kk"] as const) {
  for (const otherInformation of ["", "Дополнительные сведения / Қосымша мәліметтер"]) {
    test(`${language}: новая форма жалобы, иные сведения ${otherInformation ? "заполнены" : "необязательны"}, реквизиты после подписания`, () => {
      const { state, source, draft } = fixture(language);
      draft.place = "Старое место составления";
      draft.postalAddress = "Отдельный почтовый адрес";
      draft.otherInformation = otherInformation;
      const savedState = saveSubjectAppealDraft(state, draft, "subject2");
      assert.equal(savedState.subjectAppealDrafts![0].otherInformation, otherInformation);
      const editor = renderToStaticMarkup(createElement(SubjectPrescriptionForm, {
        state: savedState, role: "subject2", prescriptionId: source.sourceCaseId,
        draftId: draft.id, onClose() {}, onSave() {}, onSubmit() {},
      }));
      const otherField = editor.match(/<textarea[^>]*aria-label="Иные сведения"[^>]*>/)?.[0];
      assert.ok(otherField);
      assert.doesNotMatch(otherField, /required/);
      assert.doesNotMatch(editor, /Место составления|Жасалған жері|Старое место составления|Из кабинета объекта заявителя|Шағым беруші объектінің кабинетінен|Из исходного предписания ВГА|ІМА модулінің бастапқы нұсқамасынан/);
      const preview = subjectAppealHtml(source, draft, state.date, false, "ещё не присвоен");
      assert.doesNotMatch(preview, /ещё не присвоен|Перечень прилагаемых документов|Қоса берілетін құжаттардың тізбесі/);
      savedState.date = "2026-11-20";
      const c = submitSubjectAppeal(savedState, {...draft, place: ""}, "subject2").state.cases[0];
      const saved = JSON.parse(JSON.stringify(c.subjectAppeal!));
      assert.equal(saved.number, c.appealNumber);
      assert.equal(saved.submittedAt, "2026-11-20");
      assert.equal(saved.draft.otherInformation, otherInformation);
      const html = subjectAppealHtml(saved.report, saved.draft, saved.submittedAt, true, saved.number);
      const header = html.match(/<header[^>]*>([\s\S]*?)<\/header>/)![1];
      assert.doesNotMatch(header, /20.11.2026/);
      const title = language === "ru"
        ? `Жалоба № ${saved.number} от 20.11.2026`
        : `20.11.2026 жылғы № ${saved.number} шағым`;
      assert.ok(html.includes(`<h2>${title}</h2>`));
      const firstSection = html.match(/<section class="subject-appeal-section">([\s\S]*?)<\/section>/)![1];
      assert.ok(firstSection.includes(language === "ru" ? "1. Фамилия, имя, отчество (если оно указано в документе, удостоверяющем личность)" : "1. Жеке тұлғаның тегі, аты, әкесінің аты"));
      assert.doesNotMatch(firstSection, /место нахождения|орналасқан жері/);
      assert.ok(!firstSection.includes(source.address));
      assert.ok(firstSection.includes("Отдельный почтовый адрес"));
      const applicantLine = firstSection.match(/<p class="subject-appeal-autofill">([\s\S]*?)<\/p>/)![1];
      assert.ok(applicantLine.includes(language === "ru"
        ? `, БИН: ${source.bin}, Почтовый адрес: Отдельный почтовый адрес`
        : `, БСН: ${source.bin}, Пошталық мекенжай: Отдельный почтовый адрес`));
      assert.doesNotMatch(firstSection, /subject-appeal-postal-address/);
      assert.ok(firstSection.includes(`, ${language === "ru" ? "БИН" : "БСН"}: ${source.bin}`));
      assert.doesNotMatch(html, /<h3>2\. (БИН|БСН)<\/h3>/);
      assert.ok(html.includes(language === "ru" ? "<h3>2. Наименование административного органа, должностного лица, которым подается обращение:" : "<h3>2. Жолданым берілетін әкімшілік органның, лауазымды адамның атауы:"));
      assert.ok(html.includes(language === "ru"
        ? '<p class="subject-appeal-autofill">Апелляционная комиссия при уполномоченном органе по внутреннему государственному аудиту и финансовому контролю</p>'
        : '<p class="subject-appeal-autofill">Ішкі мемлекеттік аудит және қаржылық бақылау жөніндегі уәкілетті орган жанындағы апелляциялық комиссия</p>'));
      assert.ok(html.includes(language === "ru" ? "<h3>3. Наименование уполномоченного органа" : "<h3>3. Мемлекеттік аудит жүргізген"));
      assert.ok(html.includes(language === "ru" ? "<h3>4. Суть обращения" : "<h3>4. Жолданымның мәні"));
      assert.equal(html.includes(language === "ru" ? "5. Иные сведения" : "5. Өзге де мәліметтер"), Boolean(otherInformation));
      if (otherInformation) assert.ok(html.includes(otherInformation));
      assert.ok(html.includes("Доказательство 2.pdf"));
      assert.doesNotMatch(html, /subject-appeal-manifest">/);
      const file = c.documents.find(d => d.subjectAppealId === draft.id)!;
      assert.equal(decodeURIComponent(file.dataUrl!.slice(file.dataUrl!.indexOf(",") + 1)), html);
      const original = renderToStaticMarkup(createElement(DocumentContent, {c, kind: "original"}));
      assert.ok(original.includes(`<h2>${title}</h2>`));
    });
  }
}

test("доказательства обязательны отдельно по каждому пункту жалобы, черновик допускает незаполненные вложения", () => {
  for (const language of ["ru", "kk"] as const) {
    const {state, source, draft} = fixture(language);
    const before = structuredClone(state);
    const missing = source.points[2];
    const incomplete = {...draft, attachments: draft.attachments.filter(file => file.pointId !== missing.id)};
    assert.throws(() => submitSubjectAppeal(state, incomplete, "subject2"), /Приложите доказательства по пункту № 3/);
    assert.throws(() => submitSubjectAppeal(state, {...draft, attachments: []}, "subject2"), /Приложите доказательства/);
    assert.throws(() => submitSubjectAppeal(state, {...draft, attachments: [{...draft.attachments[0], pointId: undefined}]}, "subject2"), /Приложите доказательства/);
    assert.deepEqual(state, before);
    const saved = saveSubjectAppealDraft(state, incomplete, "subject2");
    const editor = renderToStaticMarkup(createElement(SubjectPrescriptionForm, {
      state: saved, role: "subject2", prescriptionId: source.sourceCaseId,
      draftId: draft.id, onClose() {}, onSave() {}, onSubmit() {},
    }));
    const inputs = [...editor.matchAll(/<input[^>]*type="file"[^>]*>/g)].map(match => match[0]);
    assert.equal(inputs.length, source.points.length);
    assert.ok(inputs.every(input => input.includes('aria-required="true"')));
    assert.equal(inputs.filter(input => /\srequired=""/.test(input)).length, 1);
    assert.ok(submitSubjectAppeal(saved, draft, "subject2").caseId);
    const blank = subjectAppealHtml(source, {...draft, otherInformation: " \n "}, state.date);
    assert.doesNotMatch(blank, /5\. Иные сведения|5\. Өзге де мәліметтер/);
  }
});

test("черновик жалобы восстанавливается в своей форме; описание вопроса не требуется от заявителя", () => {
  const { state, source, draft } = fixture();
  const saved = saveSubjectAppealDraft(state, draft, "subject2");
  const html = renderToStaticMarkup(
    createElement(SubjectPrescriptionForm, {
      state: saved,
      role: "subject2",
      prescriptionId: source.sourceCaseId,
      draftId: draft.id,
      onClose() {},
      onSave() {},
      onSubmit() {},
    }),
  );
  assert.ok(html.includes(source.number));
  assert.equal((html.match(/type="checkbox"/g) || []).length, 5);
  assert.ok(html.includes("Обстоятельства по пункту 1"));
  assert.ok(html.includes("Документы, подтверждающие обстоятельства"));
  assert.doesNotMatch(html, /name="pointTitle|aria-label="Описание/);
  assert.ok(
    html.includes("Описание оспариваемого вопроса заполнит рабочий орган"),
  );
  const gate = renderToStaticMarkup(
    createElement(SubjectAppealStart, {
      state: saved,
      role: "subject2",
      draftId: draft.id,
      onClose() {},
      onSave() {},
      onSubmit() {},
    }),
  );
  assert.ok(gate.includes("Жалоба на предписание"));
  const blocked = renderToStaticMarkup(
    createElement(SubjectAppealStart, {
      state: { ...saved, subjectPrescriptions: [] },
      role: "subject2",
      draftId: draft.id,
      onClose() {},
      onSave() {},
      onSubmit() {},
    }),
  );
  assert.ok(blocked.includes("Нет доступных для обжалования предписаний"));
  assert.doesNotMatch(blocked, /Подписать и направить|subject-appeal-paper/);
  assert.throws(
    () =>
      submitSubjectAppeal(
        state,
        { ...draft, selectedPointIds: ["unknown"] },
        "subject2",
      ),
    /нет в этом предписании/,
  );
  assert.throws(
    () =>
      submitSubjectAppeal(
        state,
        { ...draft, argumentsByPoint: {} },
        "subject2",
      ),
    /Заполните обстоятельства/,
  );
  assert.throws(
    () =>
      submitSubjectAppeal(
        { ...state, subjectPrescriptions: [] },
        draft,
        "subject2",
      ),
    /Предписание недоступно/,
  );
});

test("рабочий орган заполняет описание отдельно, сохраняя нарушения, доводы и подписанную форму", () => {
  const { state, draft } = fixture("kk");
  const submitted = submitSubjectAppeal(state, draft, "subject2");
  const received = submitted.state.cases[0];
  assert.throws(
    () =>
      saveSubjectIssueDescription(
        submitted.state,
        received.id,
        received.issues[0].id,
        "Описание",
        "work",
      ),
    /после назначения/,
  );
  received.status = "accepted";
  const before = structuredClone(received);
  for (const role of ["subject2", "director", "dvga", "kvga"] as Role[])
    assert.throws(
      () =>
        saveSubjectIssueDescription(
          submitted.state,
          received.id,
          received.issues[0].id,
          "Описание",
          role,
        ),
      /исполнитель рабочего органа/,
    );
  assert.throws(
    () =>
      saveSubjectIssueDescription(
        submitted.state,
        received.id,
        received.issues[0].id,
        " ",
        "work",
      ),
    /Заполните описание/,
  );
  const next = saveSubjectIssueDescription(
    submitted.state,
    received.id,
    received.issues[0].id,
    "Мәселенің сипаттамасы",
    "work",
  );
  const c = next.cases[0];
  assert.equal(c.issues[0].title, "Мәселенің сипаттамасы");
  assert.equal(c.issues[0].translations?.kk?.title, "Мәселенің сипаттамасы");
  assert.equal(c.issues[1].title, "");
  assert.deepEqual(c.subjectAppeal, before.subjectAppeal);
  assert.deepEqual(c.documents, before.documents);
  assert.deepEqual(
    c.issues.map((p) => [p.prescriptionText, p.authorityFinding, p.argument]),
    before.issues.map((p) => [
      p.prescriptionText,
      p.authorityFinding,
      p.argument,
    ]),
  );
  assert.match(c.history.at(-1)!.title, /Заполнено описание/);
  const view = (role: Role) =>
    renderToStaticMarkup(
      createElement(CaseWorkspace, {
        c,
        role,
        tab: "overview",
        onBack() {},
        onTab() {},
        onAction() {},
        onDocument() {},
        onUpload() {},
        onSaveIssueDescription() {},
      }),
    );
  assert.match(view("work"), /Заполнить описание|Изменить описание/);
  assert.doesNotMatch(view("subject2"), /Заполнить описание|Изменить описание/);
});

test("нарушения из предписания поступают в запрос и форму КВГА/ДВГА отдельно от описания вопроса", () => {
  const { state, draft, source } = fixture();
  const c = submitSubjectAppeal(state, draft, "subject2").state.cases[0];
  c.requests = [
    {
      id: "authority-request",
      recipient: "ДВГА по Атырауской области",
      template: "dvga",
      date: state.date,
      sent: state.date,
      deadline: state.date,
      text: "Запрос",
    },
  ];
  const fields = actionForm(
    "fill-request-response",
    c,
    state.date,
    {},
    "dvga",
  ).fields;
  for (const p of source.points) {
    assert.equal(
      fields.find((f) => f.name === `authorityFinding_${p.id}`)?.value,
      p.prescriptionText?.ru,
    );
    assert.equal(
      fields.find((f) => f.name === `authorityFindingKk_${p.id}`)?.value,
      p.prescriptionText?.kk,
    );
  }
  for (const language of ["ru", "kk"] as const) {
    c.appealLanguage = language;
    const html = renderToStaticMarkup(
      createElement(DocumentContent, { c, kind: "request-appendix", language }),
    );
    assert.ok(html.includes(source.points[0].prescriptionText![language]!));
  }
  assert.deepEqual(DEMO_SUBJECT_PRESCRIPTION, source);
});


test("жалоба на предписание по профилактическому контролю сохраняет нужный подвид", () => {
  const state = initialState();
  state.date = "2026-11-19";
  const available = subjectPrescriptions(state, "subject2");
  const preventive = available.find((p) => p.prescriptionSubtype === "preventive");
  assert.ok(preventive);
  assert.equal(preventive.relatedAuditReport, undefined);
  assert.equal(preventive.points.length, 2);
  const draft = createSubjectAppealDraft(preventive, "preventive-draft");
  draft.signerName = "Тестовый подписант";
  draft.selectedPointIds = [preventive.points[0].id];
  draft.argumentsByPoint = { [preventive.points[0].id]: "Обстоятельства по пункту 1" };
  draft.attachments = [{
    id: "proof-preventive-1",
    name: "Документ.pdf",
    size: 1,
    dataUrl: "data:application/pdf;base64,YQ==",
    pointId: preventive.points[0].id,
  }];
  const submitted = submitSubjectAppeal(state, draft, "subject2").state.cases[0];
  assert.equal(submitted.appealType, "Жалоба на решение КВГА/ДВГА");
  assert.equal(submitted.agendaDetails?.decisionKind, "prescription-preventive");
  assert.equal(submitted.agendaDetails?.relatedDocumentNumber, undefined);
  assert.equal(submitted.document.name, "Предписание по профилактическому контролю");
  const html = subjectAppealHtml(preventive, draft, state.date);
  assert.match(html, /На предписание об устранении нарушений по результатам профилактического контроля/);
  assert.doesNotMatch(html, /Связанный аудиторский отчёт/);
  const saved = { ...state, subjectAppealDrafts: [draft] };
  const editor = renderToStaticMarkup(createElement(SubjectAppealStart, {
    state: saved, role: "subject2", draftId: draft.id,
    onClose() {}, onSave() {}, onSubmit() {},
  }));
  assert.match(editor, /ТЕСТ-ПК-2026-001/);
  assert.match(editor, /subject-appeal-paper/);
});


test("жалоба на акт о результате профилактического контроля: форма, регистрация и отправка", () => {
  const state = initialState();
  state.date = "2026-11-19";
  const act = subjectPrescriptions(state, "subject2").find(
    (source) => source.documentKind === "preventive-act",
  );
  assert.ok(act);
  assert.equal(act.relatedAuditReport, undefined);
  const draft = createSubjectAppealDraft(act, "control-act-draft");
  assert.equal(draft.documentKind, "preventive-act");
  draft.signerName = "Тестовый подписант";
  draft.selectedPointIds = [act.points[0].id];
  draft.argumentsByPoint = { [act.points[0].id]: "Обстоятельства по акту" };
  draft.attachments = [{
    id: "proof-act-1",
    name: "Доказательство.pdf",
    size: 1,
    dataUrl: "data:application/pdf;base64,YQ==",
    pointId: act.points[0].id,
  }];
  const html = subjectAppealHtml(act, draft, state.date);
  assert.match(html, /На акт о результате профилактического контроля/);
  assert.doesNotMatch(html, /На предписание об устранении нарушений/);
  const form = renderToStaticMarkup(createElement(SubjectPrescriptionForm, {
    state, role: "subject2", prescriptionId: act.sourceCaseId,
    onClose() {}, onSave() {}, onSubmit() {},
  }));
  assert.match(form, /Жалоба на акт о результате профилактического контроля/);
  assert.match(form, /Пункт акта №/);
  assert.match(form, /Тестовое нарушение № 1/);
  const result = submitSubjectAppeal(state, draft, "subject2");
  const submitted = result.state.cases[0];
  assert.match(submitted.id, /^Ж-2026-/);
  assert.equal(submitted.type, "control");
  assert.equal(submitted.appealType, "Жалоба на решение КВГА/ДВГА");
  assert.equal(submitted.agendaDetails?.decisionKind, "preventive-control-act");
  assert.equal(submitted.document.name, "Акт о результате профилактического контроля");
  assert.equal(submitted.issues[0].authorityFinding, act.points[0].finding);
  assert.match(submitted.request, /Жалоба на акт о результате профилактического контроля/);
  assert.equal(submitted.subjectAppeal?.draft.documentKind, "preventive-act");
  assert.ok(result.state.notifications.some((n) => n.caseId === submitted.id && n.recipientRole === "director"));
  const stored = saveSubjectAppealDraft(state, draft, "subject2");
  const continued = renderToStaticMarkup(createElement(SubjectAppealStart, {
    state: stored, role: "subject2", draftId: draft.id,
    onClose() {}, onSave() {}, onSubmit() {},
  }));
  assert.match(continued, /Жалоба на акт о результате профилактического контроля/);
});
