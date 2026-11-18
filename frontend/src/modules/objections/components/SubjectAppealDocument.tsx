import type { ChangeEvent, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SubjectAppealDraft, SubjectAuditReport } from "../../../types";
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
  onChange,
  pointEditor,
  attachmentsEditor,
}: {
  report: SubjectAuditReport;
  draft: SubjectAppealDraft;
  date: string;
  submitted?: boolean;
  onChange?: (draft: SubjectAppealDraft) => void;
  pointEditor?: ReactNode;
  attachmentsEditor?: ReactNode;
}) {
  const kk = draft.language === "kk";
  const t = (ru: string, kz: string) => (kk ? kz : ru);
  const applicant = report.orgTranslations?.[draft.language] || report.org;
  const authority = kk
    ? auditAuthorityKazakhName(report.issuer)
    : auditAuthorityFullName(report.issuer);
  const selected = report.points.filter((point) =>
    draft.selectedPointIds.includes(point.id),
  );
  const perPointCircumstances =
    !submitted || draft.circumstancesMode === "per-point";
  const field = (
    key: "circumstances" | "signerName" | "signerPosition" | "place",
    label: string,
    multiline = false,
  ) => {
    if (!onChange)
      return <p className="subject-appeal-value">{draft[key] || "—"}</p>;
    const props = {
      "aria-label": label,
      value: draft[key],
      required: key !== "signerPosition",
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        onChange({ ...draft, [key]: event.target.value }),
    };
    return multiline ? (
      <textarea
        {...props}
        rows={5}
        placeholder={t(
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
      {selected.map((point) => (
        <div className="subject-appeal-argument" key={point.id}>
          <h4>
            № {point.number}. {(kk ? point.titleKk : point.titleRu) || point.title}
          </h4>
          <p>
            <b>{t("Обоснование:", "Негіздеме:")}</b>{" "}
            {draft.argumentsByPoint[point.id]}
          </p>
        </div>
      ))}
    </section>
  );
  return (
    <article className="print-document subject-appeal-paper">
      <header className="subject-appeal-addressee">
        <p>
          {t(
            "В Апелляционную комиссию при уполномоченном органе по внутреннему государственному аудиту и финансовому контролю",
            "Ішкі мемлекеттік аудит және қаржылық бақылау жөніндегі уәкілетті орган жанындағы апелляциялық комиссияға",
          )}
        </p>
        <p>
          <b>{t("Копия:", "Көшірме:")}</b> {authority}
        </p>
        <div className="subject-appeal-place">
          {field("place", t("Место составления", "Жасалған жері"))}
          <small>{t("Место составления", "Жасалған жері")}</small>
        </div>
        <p>{formatDate(date)}</p>
      </header>
      <h2>{t("Возражение", "Қарсылық")}</h2>
      <p className="subject-appeal-reference">
        {t("На аудиторский отчёт", "Аудиторлық есепке")} № {report.number}{" "}
        {t("от", "күні")} {formatDate(report.date)}
      </p>
      <section className="subject-appeal-section">
        <h3>
          {t(
            "1. Лицо, подающее возражение, и его место нахождения",
            "1. Қарсылық беруші және оның орналасқан жері",
          )}
        </h3>
        <p className="subject-appeal-autofill">
          {applicant}
          <br />
          {report.address}
        </p>
        {onChange && (
          <small>
            {t(
              "Из кабинета объекта заявителя",
              "Шағым беруші объектінің кабинетінен",
            )}
          </small>
        )}
      </section>
      <section className="subject-appeal-section">
        <h3>
          2.{" "}
          {kk
            ? report.identifierType === "ИИН"
              ? "ЖСН"
              : "БСН"
            : report.identifierType}
        </h3>
        <p className="subject-appeal-autofill">{report.bin}</p>
      </section>
      <section className="subject-appeal-section">
        <h3>
          {t(
            "3. Наименование уполномоченного органа по внутреннему государственному аудиту, проводившего государственный аудит",
            "3. Мемлекеттік аудит жүргізген ішкі мемлекеттік аудит жөніндегі уәкілетті органның атауы",
          )}
        </h3>
        <p className="subject-appeal-autofill">{authority}</p>
        {onChange && (
          <small>
            {t(
              "Из исходного аудиторского отчёта ВГА",
              "ІМА модулінің бастапқы аудиторлық есебінен",
            )}
          </small>
        )}
      </section>
      <section className="subject-appeal-section">
        <h3>
          {t(
            "4. Обстоятельства, на которые объект государственного аудита, подающий возражение, основывает свои требования.",
            "4. Қарсылық беруші мемлекеттік аудит объектісі өз талаптарын негіздейтін мән-жайлар.",
          )}
          {!perPointCircumstances && onChange && (
            <span className="required"> *</span>
          )}
        </h3>
        {!perPointCircumstances &&
          field("circumstances", t("Обстоятельства", "Мән-жайлар"), true)}
        {pointEditor || (perPointCircumstances && pointSummary)}
      </section>
      <section className="subject-appeal-section">
        <h3>
          {t(
            "5. Перечень прилагаемых документов",
            "5. Қоса берілетін құжаттардың тізбесі",
          )}
        </h3>
        {attachmentsEditor}
        <ol className="subject-appeal-manifest">
          {draft.attachments.map((file) => (
            <li key={file.id}>{file.name}</li>
          ))}
        </ol>
        {!draft.attachments.length && (
          <p>{t("Не приложены", "Қоса берілмеген")}</p>
        )}
      </section>
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
) {
  const body = renderToStaticMarkup(
    <SubjectAppealDocument
      report={report}
      draft={draft}
      date={date}
      submitted={submitted}
    />,
  );
  const css =
    "body{font:12pt 'Times New Roman',serif;color:#111;margin:25mm auto;max-width:180mm;padding:0 12mm}h2{text-align:center;font-size:16pt}h3{font-size:12pt;font-weight:normal}.subject-appeal-addressee{max-width:88mm;margin-left:auto}.subject-appeal-reference{text-align:center}.subject-appeal-value,p{white-space:pre-wrap;line-height:1.45}.subject-appeal-arguments{break-before:page;margin-top:24mm}.subject-appeal-argument{margin:0 0 7mm;overflow-wrap:anywhere}.subject-appeal-argument h4{font:inherit;font-weight:bold;text-align:left;margin:0 0 2mm;white-space:pre-wrap;break-after:avoid}.subject-appeal-argument p{margin:0;orphans:2;widows:2}.subject-appeal-demo-signature{font-size:10pt;color:#555}li{overflow-wrap:anywhere}@media print{body{margin:0;max-width:none;padding:0}@page{size:A4;margin:20mm}}";
  return (
    '<!DOCTYPE html><html lang="' +
    (draft.language === "kk" ? "kk" : "ru") +
    '"><head><meta charset="UTF-8"><title>Обращение по отчёту</title><style>' +
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
) {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("Разрешите открытие окна для печати.");
  popup.document.open();
  popup.document.write(subjectAppealHtml(report, draft, date, submitted));
  popup.document.close();
  popup.focus();
  popup.print();
}
