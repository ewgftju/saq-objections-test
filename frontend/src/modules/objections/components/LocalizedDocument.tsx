import { appendixPageCount } from "./DocumentModal";
import type { DocumentContentProps } from "./DocumentModal";
import { requiresMotivatedResponse } from "../formDefinitions";
import type { DocumentLanguage, ObjectionCase, Outcome } from "../../../types";
import { localizedCase } from "../services/documentLanguage";
import {
  decisionProjectDavga,
  motivatedResponseDavga,
} from "../services/protocolReason";
import {
  overall,
  pointOutcomeFromVotes,
  presidingChairId,
} from "../services/decisions";
import {
  auditAuthorityFullName,
  auditAuthorityKazakhName,
} from "../../../utils/auditAuthority";
import { formatDate } from "../../../utils/dateFormat";
import {
  agendaOrProtocolIntro,
  certificateTemplateIntro,
} from "../services/appealTemplates";
import { OUTCOMES } from "../../../data/constants";

const outcomesKk: Record<Outcome, string> = {
  accept: "Қанағаттандыру",
  partial: "Ішінара қанағаттандыру",
  reject: "Қанағаттандырудан бас тарту",
  refuse: "Қараудан бас тарту",
};
const kinds: Record<string, string> = {
  "Возражение на аудиторский отчет": "Аудиторлық есепке қарсылық",
  "Возражение на аудиторский отчёт": "Аудиторлық есепке қарсылық",
  "Возражение на уведомление": "Хабарламаға қарсылық",
  "Возражение на уведомления": "Хабарламаға қарсылық",
  "Жалоба на уведомление": "Хабарламаға шағым",
  "Жалоба на решение КВГА/ДВГА": "ІМАК/ІМАД шешіміне шағым",
  "Жалоба на действие/бездействие": "Әрекетке (әрекетсіздікке) шағым",
  Заявление: "Өтініш",
};
function memberRank(name: string) {
  const value = name.toLowerCase();
  return /директор\s+давга/.test(value)
    ? 0
    : /заместител\S*\s+председател/.test(value)
      ? 1
      : /заместител\S*\s+директор/.test(value)
        ? 3
        : /директор/.test(value)
          ? 2
          : /руководител\S*\s+управлен/.test(value)
            ? 4
            : /представител/.test(value)
              ? 5
              : 6;
}
function memberName(name: string, language: DocumentLanguage) {
  if (language === "ru") return name;
  return name
    .replace(/^Заместитель [Пп]редседателя/, "Төрағаның орынбасары")
    .replace(/^Заместитель директора/, "Директордың орынбасары")
    .replace(/^Руководитель управления/, "Басқарма басшысы")
    .replace(/^Председатель комиссии/, "Комиссия төрағасы")
    .replace(/^Член комиссии/, "Комиссия мүшесі")
    .replace(/^Вице-министр/, "Вице-министр")
    .replace(/^Представитель/, "Өкіл")
    .replace(/^Директор /, "Директор ");
}
function intro(c: ObjectionCase, kk: boolean, certificate = false) {
  if (!kk)
    return (
      (certificate ? certificateTemplateIntro(c) : agendaOrProtocolIntro(c)) ||
      `${c.appealType || "Обращение"} от ${c.org}, ${c.applicantIdentifierType || "БИН"} ${c.bin}, № ${c.appealNumber || c.id} от ${formatDate(c.appealDate || c.filed)}, на документ ${c.document.name} № ${c.document.number} от ${formatDate(c.document.date)}, орган аудита: ${auditAuthorityFullName(c.issuer)}.`
    );
  return `${certificate ? "Қазақстан Республикасы Қаржы министрлігіне " : ""}${c.org}, ${c.applicantIdentifierType === "ИИН" ? "ЖСН" : "БСН"} ${c.bin}, ${formatDate(c.appealDate || c.filed)} күнгі № ${c.appealNumber || c.id} ${kinds[c.appealType || ""] || "өтініш"}${certificate ? " келіп түсті" : ""}. Аудит органы: ${auditAuthorityKazakhName(c.issuer)}. Дауланатын құжат: № ${c.document.number}, ${formatDate(c.document.date)}.`;
}

/** Templates contain translated labels only; user-entered content comes from saved language fields. */
export function LocalizedDocument(
  props: DocumentContentProps & { language: DocumentLanguage },
) {
  const { language, kind, document } = props;
  const kk = language === "kk";
  const t = (ru: string, kz: string) => (kk ? kz : ru);
  const source = document?.snapshot
    ? {
        ...props.c,
        ...document.snapshot,
        decisionProjectDavgaOverrides:
          document.snapshot.decisionProjectDavgaOverrides,
      }
    : props.c;
  const c = localizedCase(source, language);
  const points = c.issues.filter((p) => p.disputed);
  const authorityName = kk
    ? auditAuthorityKazakhName(c.issuer)
    : auditAuthorityFullName(c.issuer);
  const outcomeLabel = (outcome?: string) =>
    outcome && outcome in OUTCOMES
      ? kk
        ? outcomesKk[outcome as Outcome]
        : OUTCOMES[outcome as Outcome]
      : "—";
  const certificate = props.certificatePreview
    ? kk
      ? {
          ...props.certificatePreview,
          davgaArguments: "",
          davgaArgumentsByPoint:
            props.certificatePreview.davgaArgumentsByPointKk,
          memberPositions: props.certificatePreview.memberPositions.map(
            (v) => ({ ...v, comment: v.commentKk || "" }),
          ),
        }
      : props.certificatePreview
    : c.certificate;
  const meeting = props.protocolPreview || c.meeting;
  const members = [...(props.protocolPreview?.members || c.members)].filter(
    (m) => !("present" in m) || m.present,
  );
  const chair = presidingChairId(members);
  members.sort(
    (a, b) =>
      (a.id === chair ? -1 : memberRank(a.name)) -
      (b.id === chair ? -1 : memberRank(b.name)),
  );
  const pTitle = t("Пункт", "Тармақ");
  const request = document?.requestId
    ? c.requests.find((r) => r.id === document.requestId)
    : undefined;
  const issuedResponse = document?.requestId
    ? props.c.requests.find((r) => r.id === document.requestId)
    : undefined;
  const responses = (id: string, field: "finding" | "response") =>
    c.requests
      .filter((r) => /ДВГА|КВГА/.test(r.recipient))
      .map((r) => ({
        authority: r.recipient.includes("КВГА")
          ? t("КВГА", "ІМАК")
          : t("ДВГА", "ІМАД"),
        value: r.authorityResponses?.[id]?.[field] || "—",
      }));
  const registration =
    document?.signedDocumentNumber && document.signedDocumentDate
      ? `№ ${document.signedDocumentNumber} ${t("от", "күні")} ${formatDate(document.signedDocumentDate)}`
      : "";

  if (kind === "authority-response-appendix")
    return (
      <article className="print-document appendix-template" lang={language}>
        <p>
          {issuedResponse?.responseNumber && issuedResponse.responseSigned
            ? `№ ${issuedResponse.responseNumber} ${t("от", "күні")} ${formatDate(issuedResponse.responseSigned)}`
            : ""}
        </p>
        <h2>{t("Ответ на запрос", "Сұрау салуға жауап")}</h2>
        <table>
          <thead>
            <tr>
              <th>№</th>
              <th>{t("Нарушение", "Бұзушылық")}</th>
              <th>{t("Доводы заявителя", "Өтініш берушінің дәлелдері")}</th>
              <th>{t("Мотивированный ответ", "Уәжді жауап")}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.id}>
                <td>{p.number}</td>
                <td>
                  {props.appendixFindingPreview?.[p.id] ??
                    request?.authorityResponses?.[p.id]?.finding ??
                    ""}
                </td>
                <td>{p.argument || "—"}</td>
                <td>
                  {props.appendixPreview?.[p.id] ??
                    request?.authorityResponses?.[p.id]?.response ??
                    ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    );

  if (kind === "certificate")
    return (
      <article className="print-document certificate-template" lang={language}>
        <h1>
          {t("Справка", "Анықтама")}
          {document?.certificateNumber
            ? ` № ${document.certificateNumber}`
            : ""}
        </h1>
        <h2>
          {t(
            "по результатам изучения и анализа обращения",
            "өтінішті зерделеу және талдау нәтижелері бойынша",
          )}
        </h2>
        <p className="certificate-template-intro">{intro(c, kk, true)}</p>
        <p>{authorityName}</p>
        <p>
          {t(
            "По результатам проведенного анализа рабочий орган (ДАВГА) сообщает следующее:",
            "Жүргізілген талдау нәтижелері бойынша жұмыс органы (ДАВГА) мынаны хабарлайды:",
          )}
        </p>
        {points.map((p) => (
          <section className="certificate-template-point" key={p.id}>
            <h3>
              {pTitle} {p.number}. {p.title}
            </h3>
            {responses(p.id, "finding").map((r, i) => (
              <p className="certificate-template-line" key={i}>
                <b>
                  {t("Доводы", "Дәлелдер")} {r.authority}:{" "}
                </b>
                {r.value}
              </p>
            ))}
            <p className="certificate-template-line">
              <b>
                {t(
                  "Доводы объекта государственного аудита (заявителя):",
                  "Мемлекеттік аудит объектісінің (өтініш берушінің) дәлелдері:",
                )}{" "}
              </b>
              {p.argument}
            </p>
            {(p.additionalArguments || []).map((v, i) => (
              <p key={i}>
                <b>
                  {t(
                    "Дополнительные доводы заявителя:",
                    "Өтініш берушінің қосымша дәлелдері:",
                  )}{" "}
                </b>
                {v}
              </p>
            ))}
            {responses(p.id, "response").map((r, i) => (
              <p className="certificate-template-line" key={i}>
                <b>
                  {t("Мотивированный ответ", "Уәжді жауап")} {r.authority}:{" "}
                </b>
                {r.value}
              </p>
            ))}
            <p className="certificate-template-line">
              <b>
                {t(
                  "Доводы рабочего органа (ДАВГА МФ РК):",
                  "Жұмыс органының (ҚР ҚМ ДАВГА) дәлелдері:",
                )}{" "}
              </b>
              {certificate?.davgaArgumentsByPoint?.[p.id] ||
                certificate?.davgaArguments ||
                "—"}
            </p>
            {(certificate?.memberPositions || []).some(
              (v) => v.pointId === p.id,
            ) && (
              <table className="certificate-members-table certificate-point-votes-table">
                <thead>
                  <tr>
                    {members.map((m) => (
                      <th key={m.id}>{memberName(m.name, language)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {members.map((m) => {
                      const position = certificate?.memberPositions.find(
                        (v) => v.pointId === p.id && v.id === m.id,
                      );
                      return (
                        <td key={m.id}>
                          <b>{outcomeLabel(position?.result)}</b>
                          <br />
                          {position?.comment || "—"}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            )}
          </section>
        ))}
      </article>
    );

  if (kind === "protocol")
    return (
      <article className="print-document protocol-template" lang={language}>
        <h1>
          {t("ПРОТОКОЛ", "ХАТТАМА")}
          {!props.protocolPreview && c.meeting?.signed
            ? ` № ${meeting?.number}`
            : ""}
          <br />
          {t(
            "заседания Апелляционной комиссии",
            "Апелляциялық комиссия отырысының",
          )}
        </h1>
        <div className="protocol-template-place-date">
          <span>{t("город Астана", "Астана қаласы")}</span>
          <span>{formatDate(meeting?.date)}</span>
        </div>
        <p>
          <b>
            {t("ПРИСУТСТВОВАЛИ", "ҚАТЫСҚАНДАР")} (
            {meeting?.format || "онлайн, Qosyl"}):
          </b>
        </p>
        {members.find((m) => m.id === chair) && (
          <p>
            <b>{t("Председательствующий:", "Төрағалық етуші:")} </b>
            {memberName(members.find((m) => m.id === chair)!.name, language)}
          </p>
        )}
        <p>
          <b>
            {t(
              "Члены Апелляционной комиссии:",
              "Апелляциялық комиссия мүшелері:",
            )}
          </b>
        </p>
        {members
          .filter((m) => m.id !== chair)
          .map((m) => (
            <p key={m.id}>{memberName(m.name, language)}</p>
          ))}
        <p>
          <b>
            {t(
              "Секретарь Апелляционной комиссии:",
              "Апелляциялық комиссия хатшысы:",
            )}{" "}
          </b>
          {c.assignee}
        </p>
        <p>{intro(c, kk)}</p>
        <p>
          {t(
            "Наименование органа, вынесшего обжалуемое решение:",
            "Шағым жасалатын шешімді шығарған органның атауы:",
          )}{" "}
          {authorityName}
        </p>
        <p>
          {t(
            "Количество присутствовавших членов Апелляционной комиссии:",
            "Қатысқан Апелляциялық комиссия мүшелерінің саны:",
          )}{" "}
          {members.length}
        </p>
        <p>
          <b>
            {t(
              "Результаты голосования членов Апелляционной комиссии:",
              "Апелляциялық комиссия мүшелерінің дауыс беру нәтижелері:",
            )}
          </b>
        </p>
        <table className="protocol-votes-table">
          <colgroup>
            <col style={{ width: "5%" }} />
            <col style={{ width: "38%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "41%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>№</th>
              <th>
                {t(
                  "Суть вопроса / член Апелляционной комиссии",
                  "Мәселенің мәні / Апелляциялық комиссия мүшесі",
                )}
              </th>
              <th>{t("Голос", "Дауыс")}</th>
              <th>{t("Обоснование", "Негіздеме")}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <FragmentRows
                key={p.id}
                point={p}
                members={members}
                label={outcomeLabel}
                c={c}
                preview={props.protocolPreview}
                language={language}
              />
            ))}
          </tbody>
        </table>
        <p>
          {t(
            "На основании результатов голосования членов Апелляционной комиссии принято решение:",
            "Апелляциялық комиссия мүшелерінің дауыс беру нәтижелері негізінде шешім қабылданды:",
          )}{" "}
          {outcomeLabel(overall(c))}.
        </p>
        {(kk ? meeting?.recommendationsKk : meeting?.recommendations) ? (
          <p>
            <b>{t("Рекомендации:", "Ұсынымдар:")} </b>
            {kk ? meeting?.recommendationsKk : meeting?.recommendations}
          </p>
        ) : null}
        {members.map((m) => (
          <p key={m.id}>{memberName(m.name, language)}: __________________</p>
        ))}
        <p>
          {t(
            "Секретарь Апелляционной комиссии",
            "Апелляциялық комиссия хатшысы",
          )}
          : __________________ {c.assignee}
        </p>
      </article>
    );

  const project = kind === "decision-project";
  const result = overall(c);
  const reasonFor = (id: string) =>
    project
      ? decisionProjectDavga(c, id)
      : requiresMotivatedResponse(c)
        ? (document?.snapshot?.motivatedResponseDavgaByPoint?.[id] ??
          motivatedResponseDavga(c, id))
        : c.result?.reason || "";
  const pageCount = appendixPageCount(
    points.map((p) => ({
      number: p.number,
      title: p.title,
      reason: reasonFor(p.id),
      decision: outcomeLabel(p.final || p.proposal || result),
      decidedByMajority:
        !project &&
        !requiresMotivatedResponse(c) &&
        Boolean(p.finalDecisionByMajority),
    })),
  );
  return (
    <div className="final-response-document" lang={language}>
      <article className="print-document final-response-template">
        <p>{registration}</p>
        <div className="final-response-recipient">
          <p>
            <strong>{c.org}</strong>
          </p>
          {!project && (
            <p>
              <strong>{authorityName}</strong>
            </p>
          )}
        </div>
        <div className="final-response-body">
          <p>{intro(c, kk)}</p>
          <p>
            {t(
              "В соответствии с пунктом 2 статьи 58-4 Закона возражение рассматривается в пределах вопросов, оспариваемых объектом государственного аудита.",
              "Заңның 58-4-бабының 2-тармағына сәйкес, қарсылық мемлекеттік аудит объектісі даулайтын мәселелер шегінде қаралады.",
            )}
          </p>
          <p>
            {t(
              "По итогам голосования на заседании Апелляционной комиссии принято решение:",
              "Апелляциялық комиссия отырысында дауыс беру қорытындысы бойынша шешім қабылданды:",
            )}{" "}
            {outcomeLabel(result)}.
          </p>
          <p>
            {project
              ? t(
                  "В соответствии со статьёй 73 Административного процедурно-процессуального кодекса Республики Казахстан Вы вправе выразить свою позицию по предварительному решению.",
                  "Сіз Қазақстан Республикасы Әкімшілік рәсімдік-процестік кодексінің 73-бабына сәйкес алдын ала шешімге өз ұстанымыңызды білдіруге құқылысыз.",
                )
              : t(
                  "В случае несогласия с ответом Вы вправе обжаловать решение в соответствии с пунктом 6 статьи 91 Административного процедурно-процессуального кодекса Республики Казахстан. Второму адресату направляется для сведения и работы.",
                  "Жауаппен келіспеген жағдайда, Сіз Қазақстан Республикасы Әкімшілік рәсімдік-процестік кодексінің 91-бабының 6-тармағына сәйкес шешімге шағым жасауға құқылысыз. Екінші мекенжайға мәлімет және жұмыс үшін жолданады.",
                )}
          </p>
          <p className="final-response-attachment-note">
            {t("Приложение:", "Қосымша:")} {pageCount} {t("л.", "парақта.")}
          </p>
        </div>
        <div className="final-response-signature">
          <span>
            {t(
              "Директор Департамента апелляции по внутреннему государственному аудиту",
              "Ішкі мемлекеттік аудит бойынша апелляция департаментінің директоры",
            )}
          </span>
          <b>Ш. Күреңбек тегі</b>
        </div>
        <p>
          {t("Исполнитель:", "Орын.:")} {c.assignee}
        </p>
      </article>
      <article className="print-document final-response-template final-response-appendix">
        <h2 className="final-response-appendix-title">
          {t("Приложение", "Қосымша")}
        </h2>
        {points.map((p) => {
          const winner =
            pointOutcomeFromVotes(
              c.votes?.[p.id]?.votes || {},
              c.votes?.[p.id]?.chair,
            ) ||
            p.final ||
            p.proposal;
          const text = reasonFor(p.id);
          return (
            <section className="final-response-appendix-point" key={p.id}>
              <p>
                - {t("по п.", "тармақ бойынша")} {p.number}:
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>{text || "—"}</p>
              <p>
                {t(
                  "На основании вышеизложенного, Апелляционной комиссией принято решение по данному вопросу:",
                  "Жоғарыда айтылғандардың негізінде Апелляциялық комиссия осы мәселе бойынша шешім қабылдады:",
                )}{" "}
                {outcomeLabel(winner)}
                {!project &&
                !requiresMotivatedResponse(c) &&
                (props.finalResponseMajorityByPoint?.[p.id] ??
                  p.finalDecisionByMajority)
                  ? t(" большинством голосов", " көпшілік дауыспен")
                  : ""}
                .
              </p>
            </section>
          );
        })}
      </article>
    </div>
  );
}

function FragmentRows({
  point,
  members,
  c,
  label,
  preview,
  language,
}: {
  point: ObjectionCase["issues"][number];
  members: Array<{ id: string; name: string }>;
  c: ObjectionCase;
  label: (outcome?: string) => string;
  preview: DocumentContentProps["protocolPreview"];
  language: DocumentLanguage;
}) {
  return (
    <>
      <tr>
        <td>{point.number}</td>
        <td colSpan={3}>{point.title}</td>
      </tr>
      {members.map((m) => {
        const row = c.meeting?.protocolVersions
          ?.at(-1)
          ?.rows.find((r) => r.pointId === point.id && r.memberId === m.id);
        const reason = preview
          ? language === "kk"
            ? preview.voteReasonsKk?.[point.id]?.[m.id]
            : preview.voteReasons?.[point.id]?.[m.id]
          : row?.edited;
        return (
          <tr key={m.id}>
            <td></td>
            <td>{memberName(m.name, language)}</td>
            <td>
              {label(
                preview?.votes[point.id]?.[m.id] ||
                  c.votes?.[point.id]?.votes?.[m.id],
              )}
            </td>
            <td style={{ whiteSpace: "pre-wrap" }}>{reason || "—"}</td>
          </tr>
        );
      })}
    </>
  );
}
