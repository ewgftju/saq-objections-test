import type { ChangeEvent, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SubjectAppealDraft, SubjectAuditReport } from "../../../types";
import { auditReportPointText } from "../services/auditProgramResults";
import {
  auditAuthorityFullName,
  auditAuthorityKazakhName,
} from "../../../utils/auditAuthority";
import { formatDate } from "../../../utils/dateFormat";

export function SubjectAppealDocument({
  report,
  draft,
  date,
  submitted = false,
  number,
  onChange,
  pointEditor,
  attachmentsEditor,
}: {
  report: SubjectAuditReport;
  draft: SubjectAppealDraft;
  date: string;
  submitted?: boolean;
  number?: string;
  onChange?: (draft: SubjectAppealDraft) => void;
  pointEditor?: ReactNode;
  attachmentsEditor?: ReactNode;
}) {
  const kk = draft.language === "kk";
  const prescription = Boolean(report.documentKind); // общий шаблон жалобы для предписаний и актов
  const t = (ru: string, kz: string) => (kk ? kz : ru);
  const applicant = report.orgTranslations?.[draft.language] || report.org;
  const identifier = kk
    ? report.identifierType === "ИИН" ? "ЖСН" : "БСН"
    : report.identifierType;
  const authority = kk
    ? auditAuthorityKazakhName(report.issuer)
    : auditAuthorityFullName(report.issuer);
  const selected = report.points.filter((point) =>
    draft.selectedPointIds.includes(point.id),
  );
  const perPointCircumstances =
    !submitted || draft.circumstancesMode === "per-point";
  const groupedDocuments = !prescription && perPointCircumstances;
  const generalAttachments = draft.attachments.filter((file) => !file.pointId);
  const attachmentGroups = [
    ...selected.map((point) => ({
      id: point.id,
      title: t(`К пункту № ${point.number}:`, `№ ${point.number} тармаққа:`),
      files: draft.attachments.filter((file) => file.pointId === point.id),
    })),
    ...(generalAttachments.length ? [{
      id: "general-attachments",
      title: t("Общие документы к возражению:", "Қарсылыққа қоса берілетін жалпы құжаттар:"),
      files: generalAttachments,
    }] : []),
  ];
  const field = (
    key: "circumstances" | "signerName" | "signerPosition" | "place" | "postalAddress" | "otherInformation",
    label: string,
    multiline = false,
  ) => {
    if (!onChange)
      return <p className="subject-appeal-value">{draft[key] || "—"}</p>;
    const props = {
      "aria-label": label,
      value: draft[key] ?? "",
      required: key !== "signerPosition" && key !== "postalAddress" && key !== "otherInformation",
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        onChange({ ...draft, [key]: event.target.value }),
    };
    return multiline ? (
      <textarea
        {...props}
        rows={5}
        placeholder={key === "otherInformation" ? t("Иные сведения (при наличии)", "Өзге де мәліметтер (бар болса)") : t(
          "Опишите обстоятельства, ваши требования и подтверждающие их факты",
          "Мән-жайларды, талаптарыңызды және оларды растайтын деректерді жазыңыз",
        )}
      />
    ) : (
      <input {...props} type="text" />
    );
  };
  const pointSummary = !onChange && (
    <section
      className={
        perPointCircumstances
          ? "subject-appeal-point-summary"
          : "subject-appeal-arguments"
      }
    >
      {!perPointCircumstances && (
        <>
          <h2>
            {t(
              "Доводы по оспариваемым вопросам",
              "Дауланатын мәселелер бойынша уәждер",
            )}
          </h2>
          <p>
            {t("Аудиторский отчёт", "Аудиторлық есеп")} № {report.number}{" "}
            {t("от", "күні")} {formatDate(report.date)}
          </p>
        </>
      )}
      {selected.map((point) => {
        const evidence = draft.attachments.filter(
          (file) => file.pointId === point.id,
        );
        return (
          <div className="subject-appeal-argument" key={point.id}>
            <h4>
              <strong>
                {prescription ? t(
                  `По пункту № ${point.number}:`,
                  `№ ${point.number} тармақ бойынша:`,
                ) : groupedDocuments ? t(
                  `По пункту № ${point.number}. ${auditReportPointText(point.auditReportPoint, "name", "ru", true) || point.titleRu || point.title}:`,
                  `№ ${point.number}. ${auditReportPointText(point.auditReportPoint, "name", "kk", true) || point.titleKk || point.title} тармағы бойынша:`,
                ) : <>№ {point.number}. {auditReportPointText(point.auditReportPoint, "name", draft.language, true) || (kk ? point.titleKk : point.titleRu) || point.title}</>}
              </strong>
            </h4>
            {!groupedDocuments && !prescription && <h5>{t("Довод заявителя", "Өтініш берушінің уәжі")}</h5>}
            {report.documentKind === "action-inaction" && <h5>{t("Обоснование:", "Негіздеме:")}</h5>}
            <p>{draft.argumentsByPoint[point.id]}</p>
            {!groupedDocuments && <>
            <h5>{t(
              prescription ? "Документы, подтверждающие обстоятельства:" : "Доказательства",
              prescription ? "Мән-жайларды растайтын құжаттар:" : "Дәлелдемелер",
            )}</h5>
            {evidence.length ? (
              <ol className="subject-appeal-evidence">
                {evidence.map((file) => (
                  <li key={file.id}>{file.name}</li>
                ))}
              </ol>
            ) : (
              <p>{t("Не приложены", "Қоса берілмеген")}</p>
            )}
            </>}
          </div>
        );
      })}
    </section>
  );
  return (
    <article className={"print-document subject-appeal-paper" + (!onChange ? " subject-appeal-final" : "")}>
      <header className="subject-appeal-addressee">
        <p>
          {t(
            prescription ? "В Апелляционную комиссию при уполномоченном органе по внутреннему государственному аудиту и финансовому контролю" : "Возражение Апелляционной комиссии при уполномоченном органе по внутреннему государственному аудиту и финансовому контролю",
            prescription ? "Ішкі мемлекеттік аудит және қаржылық бақылау жөніндегі уәкілетті орган жанындағы апелляциялық комиссияға" : "Ішкі мемлекеттік аудит және қаржылық бақылау жөніндегі уәкілетті органның жанындағы апелляциялық комиссия",
          )}
        </p>
        <p>
          <b>{t("Копия:", prescription ? "Көшірме:" : "Көшірмесі:")}</b> {authority}
        </p>
        {!prescription && (
          <div className="subject-appeal-place">
            {field("place", t("Место составления", "Жасалған жері"))}
            <small>{t("Место составления", "Жасалған жері")}</small>
          </div>
        )}
        {!prescription && <p>{formatDate(date)}</p>}
      </header>
      <h2>{prescription
        ? submitted && number
          ? kk ? `${formatDate(date)} жылғы № ${number} шағым` : `Жалоба № ${number} от ${formatDate(date)}`
          : t("Жалоба", "Шағым")
        : t("Возражение", "Қарсылық")}</h2>
      <p className="subject-appeal-reference">
        {prescription
          ? report.documentKind === "action-inaction"
            ? t("На действия (бездействие) органа аудита по обращению", "Аудит органының жолданым бойынша әрекеттеріне (әрекетсіздігіне)")
            : report.documentKind === "preventive-act"
            ? t("На акт о результате профилактического контроля", "Профилактикалық бақылау нәтижелері туралы актіге")
            : report.prescriptionSubtype === "preventive"
            ? t("На предписание об устранении нарушений по результатам профилактического контроля", "Профилактикалық бақылау нәтижелері бойынша бұзушылықтарды жою туралы нұсқамаға")
            : t("На предписание об устранении нарушений", "Бұзушылықтарды жою туралы нұсқамаға")
          : t("На аудиторский отчёт", "Аудиторлық есепке")} № {report.number}{" "}
        {t("от", "күні")} {formatDate(report.date)}
      </p>
      {prescription && report.relatedAuditReport && <p className="subject-appeal-reference">{t("Связанный аудиторский отчёт", "Байланысты аудиторлық есеп")} № {report.relatedAuditReport.number} {t("от", "күні")} {formatDate(report.relatedAuditReport.date)}</p>}
      <section className="subject-appeal-section">
        <h3>
          {t(
            prescription ? "1. Фамилия, имя, отчество (если оно указано в документе, удостоверяющем личность), индивидуальный идентификационный номер (при его наличии), почтовый адрес физического лица либо наименование, почтовый адрес, бизнес-идентификационный номер юридического лица (при его наличии)." : "1. Фамилия, имя, отчество (при его наличии) либо полное наименование лица, подающего возражение, его место жительства (место нахождения):",
            prescription ? "1. Жеке тұлғаның тегі, аты, әкесінің аты (егер ол жеке басын куәландыратын құжатта көрсетілсе), жеке сәйкестендіру нөмірі (ол болған кезде), пошталық мекенжайы не заңды тұлғаның атауы, пошталық мекенжайы, бизнес-сәйкестендіру нөмірі (ол болған кезде)." : "1. Тегі, аты, әкесінің аты (ол болған кезде) не қарсылық беруші тұлғаның толық атауы, оның тұрғылықты жері (орналасқан жері):",
          )}
        </h3>
        {report.documentKind === "action-inaction" ? (
          <div className="subject-appeal-autofill subject-appeal-applicant-details">
            <p>
              <strong>{report.identifierType === "ИИН" ? t("ФИО заявителя", "Өтініш берушінің аты-жөні") : t("Наименование заявителя", "Өтініш берушінің атауы")}:</strong>{" "}
              {applicant}
            </p>
            <p>
              <strong>{identifier}:</strong> {report.bin}
            </p>
            {!onChange && draft.postalAddress?.trim() && (
              <p><strong>{t("Почтовый адрес", "Пошталық мекенжай")}:</strong> {draft.postalAddress.trim()}</p>
            )}
          </div>
        ) : (
          <p className="subject-appeal-autofill">
            {applicant}
            {prescription && <>, {identifier}: {report.bin}</>}
            {prescription && !onChange && <>, {t("Почтовый адрес", "Пошталық мекенжай")}: {draft.postalAddress?.trim() || "—"}</>}
            {!prescription && <><br />{report.addressTranslations?.[draft.language] || report.address}</>}
          </p>
        )}
        {prescription && onChange && (
          <label className="field subject-appeal-postal-address">
            <span>Почтовый адрес</span>
            {field("postalAddress", "Почтовый адрес")}
          </label>
        )}
      </section>
      {prescription && <section className="subject-appeal-section">
        <h3>{t(
          "2. Наименование административного органа, должностного лица, которым подается обращение:",
          "2. Жолданым берілетін әкімшілік органның, лауазымды адамның атауы:",
        )}</h3>
        <p className="subject-appeal-autofill">{t(
          "Апелляционная комиссия при уполномоченном органе по внутреннему государственному аудиту и финансовому контролю",
          "Ішкі мемлекеттік аудит және қаржылық бақылау жөніндегі уәкілетті орган жанындағы апелляциялық комиссия",
        )}</p>
      </section>}
      {!prescription && <section className="subject-appeal-section">
        <h3>
          2. {report.identifierType === "БИН" ? t("Бизнес-идентификационный номер:", "Бизнес-сәйкестендіру нөмірі:") : `${identifier}:`}
        </h3>
        <p className="subject-appeal-autofill">{report.bin}</p>
      </section>}
      <section className="subject-appeal-section">
        <h3>
          3.{" "}
          {t(
            report.documentKind === "action-inaction" ? "Орган аудита (КВГА/ДВГА), действия (бездействие) которого обжалуются" : "Наименование уполномоченного органа по внутреннему государственному аудиту, проводившего государственный аудит",
            prescription ? "Мемлекеттік аудит жүргізген ішкі мемлекеттік аудит жөніндегі уәкілетті органның атауы" : "Мемлекеттік аудит жүргізген ішкі мемлекеттік аудит жөніндегі уәкілетті органның атауы:",
          )}
        </h3>
        <p className="subject-appeal-autofill">{authority}</p>
      </section>
      <section className="subject-appeal-section">
        <h3>
          {t(
            prescription ? "4. Суть обращения" : "4. Обстоятельства, на которые объект государственного аудита, подающий возражение, основывает свои требования и доказательства, подтверждающие обстоятельства",
            prescription ? "4. Жолданымның мәні" : "4. Қарсылық беретін мемлекеттік аудит объектісі өз талаптарын негіздейтін мән-жайлар және осы мән-жайларды растайтын дәлелдемелер",
          )}
          {!perPointCircumstances && onChange && (
            <span className="required"> *</span>
          )}
        </h3>
        {!perPointCircumstances &&
          field("circumstances", t("Обстоятельства", "Мән-жайлар"), true)}
        {pointEditor || (perPointCircumstances && pointSummary)}
      </section>
      {prescription ? (onChange || draft.otherInformation?.trim()) && <section className="subject-appeal-section">
        <h3>{t("5. Иные сведения", "5. Өзге де мәліметтер")}</h3>
        {field("otherInformation", onChange ? "Иные сведения" : t("Иные сведения", "Өзге де мәліметтер"), true)}
      </section> : <section className="subject-appeal-section">
        <h3>
          {t(
            "5. Перечень прилагаемых документов",
            "5. Қоса тіркелген құжаттар тізімі:",
          )}
        </h3>
        {attachmentsEditor}
        {groupedDocuments ? <>
          {attachmentGroups.map((group) => (
            <div className="subject-appeal-manifest-group" key={group.id}>
              <h4>{group.title}</h4>
              <ol className="subject-appeal-manifest">
                {group.files.map((file) => <li key={file.id}>{file.name}</li>)}
              </ol>
              {!group.files.length && <p>{t("Не приложены", "Қоса берілмеген")}</p>}
            </div>
          ))}
          {!attachmentGroups.length && <p>{t("Не приложены", "Қоса берілмеген")}</p>}
        </> : <>
        <ol className="subject-appeal-manifest">
          {draft.attachments.map((file) => (
            <li key={file.id}>{file.name}</li>
          ))}
        </ol>
        {!draft.attachments.length && (
          <p>{t("Не приложены", "Қоса берілмеген")}</p>
        )}
        </>}
      </section>}
      <section className="subject-appeal-signature">
        <h3>
          {t(
            "Руководитель объекта государственного аудита",
            "Мемлекеттік аудит объектісінің басшысы",
          )}
        </h3>
        <div className="subject-appeal-signature-fields">
          <label>
            {onChange && <small>{t("Должность", "Лауазымы")}</small>}
            {field(
              "signerPosition",
              t("Должность подписанта", "Қол қоюшының лауазымы"),
            )}
            {!onChange && <small>{t("Должность", "Лауазымы")}</small>}
          </label>
          <label>
            {onChange && (
              <small>
                {t(
                  "Ф.И.О. (при наличии отчества)",
                  "Тегі, аты, әкесінің аты (бар болса)",
                )}
              </small>
            )}
            {field(
              "signerName",
              t("Ф.И.О. подписанта", "Қол қоюшының аты-жөні"),
            )}
            {!onChange && <small>{t("Ф.И.О. подписанта", "Қол қоюшының аты-жөні")}</small>}
          </label>
        </div>
        {submitted && (
          <p className="subject-appeal-demo-signature">
            {t(
              "Направлено из кабинета объекта №2. Подписание выполнено в демонстрационном режиме.",
              "№2 объектінің кабинетінен жіберілді. Қол қою демонстрациялық режимде орындалды.",
            )}
          </p>
        )}
      </section>
      {!perPointCircumstances && pointSummary}
    </article>
  );
}

export function subjectAppealHtml(
  report: SubjectAuditReport,
  draft: SubjectAppealDraft,
  date: string,
  submitted = false,
  number?: string,
) {
  const body = renderToStaticMarkup(
    <SubjectAppealDocument
      report={report}
      draft={draft}
      date={date}
      submitted={submitted}
      number={number}
    />,
  );
  const css = `
    body{font:11.5pt/1.4 'Times New Roman',serif;color:#111;margin:16mm auto;max-width:170mm;padding:0 12mm}
    h2{text-align:center;font-size:21pt;margin:8mm 0 2mm}
    h3{font-size:11.5pt;font-weight:bold;margin:0 0 2.5mm;break-after:avoid}
    p{white-space:pre-wrap;margin:0 0 3mm}
    small{font-size:9pt;color:#666}
    .subject-appeal-addressee{width:50.5%;margin-left:auto;font-size:10pt;line-height:1.35}
    .subject-appeal-addressee p{margin:0 0 3mm}
    .subject-appeal-place .subject-appeal-value{margin-bottom:0}
    .subject-appeal-place{margin-bottom:3mm}
    .subject-appeal-reference{text-align:center;margin:0 0 7mm}
    .subject-appeal-section{margin-bottom:4mm}
    .subject-appeal-autofill{margin-left:2.5mm}
    .subject-appeal-postal-address{display:block;margin-top:3mm}
    .subject-appeal-applicant-details{margin:2mm 0 3mm 2.5mm;white-space:normal}
    .subject-appeal-applicant-details p{margin:0 0 1.5mm}
    .subject-appeal-applicant-details p:last-child{margin-bottom:0}
    .subject-appeal-postal-address>span{display:block;font-weight:bold;margin-bottom:1mm}
    .subject-appeal-arguments{break-before:page;margin-top:24mm}
    .subject-appeal-argument{margin:0 0 5mm 2.5mm;overflow-wrap:anywhere}
    .subject-appeal-argument h4{font:inherit;font-weight:bold;text-align:left;margin:0 0 2mm;white-space:pre-wrap;break-after:avoid}
    .subject-appeal-argument h5{font:inherit;font-weight:bold;margin:2.5mm 0 1mm;break-after:avoid}
    .subject-appeal-argument p{margin:0 0 0 2.5mm;orphans:2;widows:2}
    .subject-appeal-evidence{margin:0;padding-left:7mm}
    .subject-appeal-manifest{margin:0;padding-left:9.5mm}
    .subject-appeal-manifest-group{margin:0 0 3mm 2.5mm}
    .subject-appeal-manifest-group h4{font:inherit;font-weight:bold;margin:3mm 0 1mm;break-after:avoid}
    .subject-appeal-manifest-group .subject-appeal-manifest{padding-left:7mm}
    li{overflow-wrap:anywhere;white-space:pre-wrap;orphans:2;widows:2}
    .subject-appeal-signature{margin-top:6mm;break-inside:avoid}
    .subject-appeal-signature-fields{display:grid;grid-template-columns:1fr 1.5fr;gap:5mm;margin-top:2mm}
    .subject-appeal-signature-fields label:last-child{text-align:right}
    .subject-appeal-signature-fields p{margin:0 0 1mm}
    .subject-appeal-demo-signature{font-size:9pt;color:#666;margin-top:6mm}
    @media(max-width:600px){body{padding:0 5mm}.subject-appeal-addressee{width:75%}.subject-appeal-signature-fields{grid-template-columns:1fr}.subject-appeal-signature-fields label:last-child{text-align:left}}
    @media print{body{margin:0;max-width:none;padding:0}.subject-appeal-addressee{width:50.5%}.subject-appeal-signature-fields{grid-template-columns:1fr 1.5fr}.subject-appeal-signature-fields label:last-child{text-align:right}@page{size:A4;margin:16mm 20mm 15mm}}
  `;
  return (
    '<!DOCTYPE html><html lang="' +
    (draft.language === "kk" ? "kk" : "ru") +
    '"><head><meta charset="UTF-8"><title>' +
    (report.documentKind === "action-inaction" ? "Жалоба на действие/бездействие" : "Обращение") +
    '</title><style>' +
    css +
    "</style></head><body>" +
    body +
    "</body></html>"
  );
}

export function printSubjectAppeal(
  report: SubjectAuditReport,
  draft: SubjectAppealDraft,
  date: string,
  submitted = false,
  number?: string,
) {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("Разрешите открытие окна для печати.");
  popup.document.open();
  popup.document.write(subjectAppealHtml(report, draft, date, submitted, number));
  popup.document.close();
  popup.focus();
  popup.print();
}
