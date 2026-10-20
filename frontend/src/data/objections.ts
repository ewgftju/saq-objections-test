import type {
  CommissionAttendanceMember,
  CommissionMember,
  NewCaseInput,
  ObjectionCase,
} from "../types";

export const COMMISSION_ATTENDANCE_MEMBERS: CommissionAttendanceMember[] = [
  { id: "alieva-at", name: "Директор ДМБУА Алиева А.Т." },
  { id: "urkhumbayeva-tzh", name: "Руководитель управления ДМБУА Урхумбаева Т.Ж." },
  { id: "abetova-ku", name: "Заместитель директора ДЮС Абетова К.У." },
  { id: "kenbeil-dm", name: "Вице-министр Кенбеил Д.М." },
  { id: "kurenbek-shb", name: "Директор ДАВГА Күреңбек тегі Ш.Б." },
  { id: "akhmetov-rk", name: "Заместитель Председателя КВГА Ахметов Р.К." },
  { id: "turgeldiev-ra", name: "Заместитель председателя КВГА Тургелдиев Р.А." },
  { id: "seitov-et", name: "Директор ДЗГЗ Сеитов Е.Т." },
  { id: "kaskenova-i", name: "Руководитель управления ДЗГЗ Каскенова И." },
  { id: "umertayev-bk", name: "Представитель НПО «Атамекен» Умертаев Б.К." },
  { id: "gusmanova-ab", name: "Представитель АО «ЩЮЛ Застройщики» Гусманова А.Б." },
  { id: "ten-vs", name: "Представитель АО «ОЮЛ застройщиков» ТЭН В.С." },
  { id: "mikrokov-v", name: "Представитель ОЮЛ «Микроков» В." },
];
export function members(): CommissionMember[] {
  return [
    { id: "chair", name: "Председатель комиссии" },
    { id: "deputy", name: "Заместитель председателя" },
    { id: "member1", name: "Член комиссии № 1" },
    { id: "member2", name: "Член комиссии № 2" },
    { id: "member3", name: "Член комиссии № 3" },
    { id: "member4", name: "Представитель НПП «Атамекен»" },
    { id: "member5", name: "Представитель отраслевой ассоциации" },
  ].map((m) => ({ ...m, present: true, recused: false, reason: "" }));
}
export function makeCase(c: NewCaseInput): ObjectionCase {
  const receivedViaSaq = c.channel === "SAQ";
  return {
    ...c,
    status: receivedViaSaq ? "received" : "accepted",
    assignee: receivedViaSaq ? "Не назначен" : "Исполнитель рабочего органа",
    unread: receivedViaSaq,
    extensionDays: 0,
    pauseDays: 0,
    documents: [],
    requests: [],
    members: members(),
    history: [
      {
        date: c.registered,
        actor: "Объект",
        title: receivedViaSaq
          ? "Обращение поступило через SAQ"
          : "Обращение создано вручную",
        text: receivedViaSaq
          ? "Обращение направлено директору ДАВГА для выбора исполнителя рабочего органа."
          : "Обращение зарегистрировано и сразу направлено на формирование запроса.",
      },
    ],
  };
}

/**
 * Общее тестовое обращение хранится в исходных данных приложения, а не в
 * локальном хранилище конкретного браузера.
 */
export function sharedAuditObjection(): ObjectionCase {
  const c = makeCase({
    id: "В-2026-001",
    type: "audit",
    appealType: "Возражение на аудиторский отчет",
    appealNumber: "В-1",
    appealDate: "2026-09-08",
    org: 'ТОО "Объект заявителя"',
    bin: "111111111111",
    applicantIdentifierType: "БИН",
    address: "город Астана, район Есиль",
    applicant: "",
    registered: "2026-09-08",
    filed: "2026-09-08",
    channel: "SAQ",
    issuer: "ДВГА по г. Астана",
    authority: "Апелляционная комиссия при Министерстве финансов РК",
    document: {
      number: "А-25",
      date: "2026-09-03",
      received: "2026-09-08",
      name: "Аудиторский отчет",
    },
    agendaDetails: {
      auditObjectName: 'АО "Объект аудита"',
      auditObjectBin: "222222222222",
      applicantIsAuditObjectRepresentative: true,
    },
    amount: 0,
    request:
      "Требования заявителя изложены в приложенном документе «Требования заявителя».",
    issues: [
      {
        id: "audit-objection-point-1",
        number: "1",
        title: "Касательно выполнения работ",
        finding: "",
        argument:
          "Работы выполнены и подтверждаются исполнительной документацией. Просим пересмотреть вывод о неподтверждённом объёме.",
        evidence: "Доказательства.docx",
        amount: 0,
        disputed: true,
      },
      {
        id: "audit-objection-point-5",
        number: "5",
        title: "Отмечено несвоевременное отражение имущества",
        finding: "",
        argument:
          "Часть имущества отражена в учёте до окончания аудита. Просим уточнить сумму и квалификацию нарушения.",
        evidence: "Доказательства.docx",
        amount: 0,
        disputed: true,
      },
    ],
  });
  c.documents = [
    {
      name: "Доверенность.docx",
      filename: "Доверенность.docx",
      kind: "attachment",
      text: "Доверенность представителя",
      author: "Заявитель",
      date: "2026-09-08",
      dataUrl: "/test-documents/power-of-attorney.docx",
    },
    {
      name: "Требования заявителя.docx",
      filename: "Требования заявителя.docx",
      kind: "attachment",
      text: "Требования заявителя",
      author: "Заявитель",
      date: "2026-09-08",
      dataUrl: "/test-documents/applicant-requirements.docx",
    },
    {
      name: "Доказательства.docx",
      filename: "Доказательства.docx",
      kind: "attachment",
      text: "Доказательства по оспариваемым пунктам 1 и 5",
      author: "Заявитель",
      date: "2026-09-08",
      dataUrl: "/test-documents/audit-evidence.docx",
    },
  ];
  c.history.push(
    {
      date: "2026-09-08",
      actor: "Заявитель",
      title: "Добавлена доверенность представителя",
      text: "Доверенность.docx",
    },
    {
      date: "2026-09-08",
      actor: "Заявитель",
      title: "Добавлены требования заявителя",
      text: "Требования заявителя.docx",
    },
    {
      date: "2026-09-08",
      actor: "Заявитель",
      title: "Добавлены доказательства по оспариваемым пунктам",
      text: "Доказательства.docx",
    },
  );
  return c;
}

export function seed(): ObjectionCase[] {
  return [sharedAuditObjection()];
}
