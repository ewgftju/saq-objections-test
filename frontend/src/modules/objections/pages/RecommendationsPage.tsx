import { useState } from "react";
import { Button, Modal, Notice, PageHeading } from "../../../components/ui";
import { ROLES } from "../../../data/constants";
import type { CaseDocument, CaseRecommendation, Role } from "../../../types";
import { formatDate } from "../../../utils/dateFormat";

const EXECUTION_RESULT_OPTIONS = [
  "Признано соответствующим замечаниям/не соответствующим стандартам государственного аудита по итогу контроля качества второго уровня.",
  "Осуществляется перепроверка.",
  "Дисциплинарная ответственность и иные меры реагирования.",
  "Техническая учеба.",
  "Изменения в НПА.",
  "Другое",
] as const;

const STATUS_LABELS: Record<CaseRecommendation["status"], string> = {
  approval: "На согласовании",
  signature: "На подписании",
  sent: "Направлена",
  answered: "Ответ получен",
  acceptance_approval: "Принятие на согласовании",
  acceptance_signature: "Принятие на подписании",
  return_approval: "Возврат на согласовании",
  return_signature: "Возврат на подписании",
  executed: "Исполнена",
  returned: "Возвращена на доработку",
};

function statusTone(status: CaseRecommendation["status"]) {
  if (status === "executed") return "green";
  if (["returned", "return_approval", "return_signature"].includes(status))
    return "amber";
  return "blue";
}

function statusLabel(recommendation: CaseRecommendation, role: Role) {
  const recipientRole = recipientRoleOf(recommendation);
  if (role === recipientRole) {
    if (recommendation.status === "sent") return "На исполнении";
    if (recommendation.status === "answered") return "Ответ направлен";
  }
  if (recommendation.channel === "external" && recommendation.status === "sent")
    return "Направлена через другую систему";
  return STATUS_LABELS[recommendation.status];
}

/** Supports recommendations created before the recipient role was stored. */
function recipientRoleOf(recommendation: CaseRecommendation): Role | undefined {
  if (recommendation.recipientRole) return recommendation.recipientRole;
  const recipientRoles: Record<string, Role> = {
    ДВГА: "dvga",
    "Кабинет ДВГА": "dvga",
    КВГА: "kvga",
    "Кабинет КВГА": "kvga",
    Объект: "subject",
    "Кабинет Объекта": "subject",
    "Вышестоящий орган": "higher",
    "Кабинет вышестоящего органа": "higher",
  };
  return recipientRoles[recommendation.recipient];
}

export default function RecommendationsPage({
  recommendations,
  role,
  onOpenCase,
  onSubmitResponse,
  onAcceptResponse,
  onReturnForRevision,
  onApprove,
  onSign,
  documents = [],
}: {
  recommendations: CaseRecommendation[];
  role: Role;
  onOpenCase: (caseId: string) => void;
  onSubmitResponse: (
    recommendationId: string,
    answer: string,
    executionResult: string,
    files: File[],
  ) => void | Promise<void>;
  onAcceptResponse: (recommendationId: string) => void;
  onReturnForRevision: (
    recommendationId: string,
    revisionDueDate: string,
    reason: string,
    files: File[],
  ) => void | Promise<void>;
  onApprove: (recommendationId: string) => void;
  onSign: (recommendationId: string) => void;
  documents?: CaseDocument[];
}) {
  const [responseRecommendation, setResponseRecommendation] =
    useState<CaseRecommendation | null>(null);
  const [returnRecommendation, setReturnRecommendation] =
    useState<CaseRecommendation | null>(null);
  const [detailsRecommendation, setDetailsRecommendation] =
    useState<CaseRecommendation | null>(null);
  const isWork = role === "demo-superuser" || role === "work";
  const isDemo = role === "demo-superuser";
  const visibleRecommendations = recommendations.filter((recommendation) => {
    if (isWork) return true;
    if (role === "deputy")
      return ["approval", "acceptance_approval", "return_approval"].includes(
        recommendation.status,
      );
    if (role === "director")
      return ["signature", "acceptance_signature", "return_signature"].includes(
        recommendation.status,
      );
    return (
      ["sent", "answered", "returned", "executed"].includes(recommendation.status) &&
      (recipientRoleOf(recommendation) === role ||
        recommendation.recipient === ROLES[role])
    );
  });

  return (
    <>
      <PageHeading
        title="Рекомендации"
        subtitle={
          isWork
            ? "Направленные рекомендации и контроль их исполнения"
            : role === "deputy"
              ? "Рекомендации, поступившие на согласование"
              : role === "director"
                ? "Рекомендации и решения по исполнению, поступившие на подписание"
                : "Рекомендации, направленные в ваш кабинет для исполнения"
        }
      />
      {visibleRecommendations.length === 0 ? (
        <Notice>Рекомендаций пока нет.</Notice>
      ) : (
        <section className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>№</th>
                  <th>Кому направлена рекомендация</th>
                  <th>Способ направления</th>
                  <th>Дата направления</th>
                  <th>Срок исполнения</th>
                  <th>Результат</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecommendations.map((recommendation, index) => {
                  const recipientRole = recipientRoleOf(recommendation);
                  const canRespond =
                    (isDemo || role === recipientRole) &&
                    ["sent", "returned"].includes(recommendation.status) &&
                    recommendation.channel !== "external";
                  const canReview =
                    isWork && recommendation.status === "answered";
                  const canApprove =
                    (role === "deputy" || isDemo) &&
                    ["approval", "acceptance_approval", "return_approval"].includes(
                      recommendation.status,
                    );
                  const canSign =
                    (role === "director" || isDemo) &&
                    ["signature", "acceptance_signature", "return_signature"].includes(
                      recommendation.status,
                    );
                  return (
                    <tr key={recommendation.id}>
                      <td>{index + 1}</td>
                      <td>{recommendation.recipient}</td>
                      <td>
                        {recommendation.channel === "external"
                          ? recommendation.deliveryPath || "Другая система"
                          : "Кабинет SAQ"}
                        {recommendation.registrationNumber && (
                          <small className="subline">
                            № {recommendation.registrationNumber}
                          </small>
                        )}
                      </td>
                      <td>{formatDate(recommendation.sentAt || recommendation.createdAt)}</td>
                      <td>
                        {formatDate(
                          recommendation.revisionDueDate || recommendation.dueDate,
                        )}
                      </td>
                      <td>{recommendation.executionResult || "—"}</td>
                      <td>
                        <span className={`badge ${statusTone(recommendation.status)}`}>
                          {statusLabel(recommendation, role)}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <Button
                            primary
                            onClick={() => setDetailsRecommendation(recommendation)}
                          >
                            Подробнее
                          </Button>
                          <Button onClick={() => onOpenCase(recommendation.caseId)}>
                            Обращение
                          </Button>
                          {canRespond &&
                            (recommendation.status === "sent" ||
                              recommendation.status === "returned") && (
                              <Button
                                primary
                                onClick={() => setResponseRecommendation(recommendation)}
                              >
                                {recommendation.status === "returned"
                                  ? "Доработать исполнение"
                                  : "Направить исполнение"}
                              </Button>
                            )}
                          {canReview && (
                            <>
                              <Button
                                primary
                                onClick={() => onAcceptResponse(recommendation.id)}
                              >
                                Направить принятие на согласование
                              </Button>
                              <Button onClick={() => setReturnRecommendation(recommendation)}>
                                Вернуть на доработку
                              </Button>
                            </>
                          )}
                          {canApprove && (
                            <Button primary onClick={() => onApprove(recommendation.id)}>
                              Согласовать
                            </Button>
                          )}
                          {canSign && (
                            <Button primary onClick={() => onSign(recommendation.id)}>
                              Подписать
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {detailsRecommendation && (() => {
        const recommendationDocuments = documents.filter(
          (document) => document.recommendationId === detailsRecommendation.id,
        );
        const answerDocuments = recommendationDocuments.filter(
          (document) => document.kind === "recommendation-response-attachment",
        );
        const returnDocuments = recommendationDocuments.filter(
          (document) => document.kind === "recommendation-return-attachment",
        );
        const sourceDocuments = recommendationDocuments.filter(
          (document) => document.kind === "recommendation-attachment",
        );
        return (
          <Modal
            title={`Рекомендация № ${detailsRecommendation.id}`}
            onClose={() => setDetailsRecommendation(null)}
            wide
          >
            <div className="recommendation-details">
              <section className="recommendation-summary">
                <span className={`badge ${statusTone(detailsRecommendation.status)}`}>
                  {statusLabel(detailsRecommendation, role)}
                </span>
                <p>{detailsRecommendation.text}</p>
              </section>
              <div className="recommendation-facts">
                <div><span>Кому направлена</span><strong>{detailsRecommendation.recipient}</strong></div>
                <div>
                  <span>Способ направления</span>
                  <strong>
                    {detailsRecommendation.channel === "external"
                      ? detailsRecommendation.deliveryPath || "Другая система"
                      : "Кабинет SAQ"}
                  </strong>
                  {detailsRecommendation.registrationNumber && (
                    <small>№ {detailsRecommendation.registrationNumber}</small>
                  )}
                </div>
                <div><span>Дата направления</span><strong>{formatDate(detailsRecommendation.sentAt || detailsRecommendation.createdAt)}</strong></div>
                <div><span>Срок исполнения</span><strong>{formatDate(detailsRecommendation.revisionDueDate || detailsRecommendation.dueDate)}</strong></div>
                <div><span>Результат исполнения</span><strong>{detailsRecommendation.executionResult || "Не указан"}</strong></div>
                <div><span>Версия ответа</span><strong>{detailsRecommendation.responseVersion ? `№ ${detailsRecommendation.responseVersion}` : "Ответа пока нет"}</strong></div>
              </div>
              {detailsRecommendation.answer && (
                <section className="recommendation-note">
                  <h4>Ответ исполнителя</h4>
                  <p>{detailsRecommendation.answer}</p>
                </section>
              )}
              {detailsRecommendation.returnReason && (
                <section className="recommendation-note return-note">
                  <h4>Причина возврата на доработку</h4>
                  <p>{detailsRecommendation.returnReason}</p>
                </section>
              )}
              {recommendationDocuments.length > 0 && (
                <section className="recommendation-files">
                  <h4>Документы</h4>
                  {[
                    ["Материалы рекомендации", sourceDocuments],
                    ["Файлы исполнения", answerDocuments],
                    ["Файлы возврата", returnDocuments],
                  ].map(([label, files]) =>
                    Array.isArray(files) && files.length > 0 ? (
                      <div className="recommendation-file-group" key={label as string}>
                        <span>{label as string}</span>
                        {files.map((document, documentIndex) => document.dataUrl ? (
                          <a
                            href={document.dataUrl}
                            download={document.filename || document.name}
                            key={`${document.name}-${documentIndex}`}
                          >
                            {document.filename || document.name}
                          </a>
                        ) : null)}
                      </div>
                    ) : null,
                  )}
                </section>
              )}
              <div className="actions">
                <Button onClick={() => onOpenCase(detailsRecommendation.caseId)}>
                  Открыть обращение
                </Button>
                <Button onClick={() => setDetailsRecommendation(null)}>Закрыть</Button>
              </div>
            </div>
          </Modal>
        );
      })()}
      {responseRecommendation && (
        <Modal title="Ответ на рекомендацию" onClose={() => setResponseRecommendation(null)}>
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const answer = String(form.get("answer") || "").trim();
              const executionResult = String(
                form.get("executionResult") || "",
              ).trim();
              const files = form
                .getAll("responseFiles")
                .filter(
                  (value): value is File =>
                    value instanceof File && value.name.length > 0,
                );
              if (!answer || !executionResult) return;
              await onSubmitResponse(
                responseRecommendation.id,
                answer,
                executionResult,
                files,
              );
              setResponseRecommendation(null);
            }}
          >
            <label className="field">
              <span>
                Результат исполнения рекомендации <span className="required">*</span>
              </span>
              <select name="executionResult" required defaultValue="">
                <option value="" disabled>Выберите результат</option>
                {EXECUTION_RESULT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Ответ <span className="required">*</span></span>
              <textarea name="answer" required rows={5} />
            </label>
            <label className="field">
              <span>Вложить файл</span>
              <input
                type="file"
                name="responseFiles"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt"
                multiple
              />
              <small>Необязательное вложение до 2 МБ каждый.</small>
            </label>
            <div className="actions">
              <Button type="button" onClick={() => setResponseRecommendation(null)}>
                Отмена
              </Button>
              <Button primary type="submit">Направить ответ</Button>
            </div>
          </form>
        </Modal>
      )}
      {returnRecommendation && (
        <Modal
          title="Вернуть ответ на доработку"
          onClose={() => setReturnRecommendation(null)}
        >
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const revisionDueDate = String(
                form.get("revisionDueDate") || "",
              );
              const reason = String(form.get("returnReason") || "").trim();
              const files = form
                .getAll("returnFiles")
                .filter(
                  (value): value is File =>
                    value instanceof File && value.name.length > 0,
                );
              if (!revisionDueDate || (!reason && !files.length)) return;
              await onReturnForRevision(
                returnRecommendation.id,
                revisionDueDate,
                reason,
                files,
              );
              setReturnRecommendation(null);
            }}
          >
            <label className="field">
              <span>
                Срок исполнения доработки <span className="required">*</span>
              </span>
              <input
                type="date"
                name="revisionDueDate"
                defaultValue={returnRecommendation.dueDate || ""}
                required
              />
            </label>
            <label className="field">
              <span>Причина возврата</span>
              <textarea name="returnReason" rows={4} />
            </label>
            <label className="field">
              <span>Вложить файл с причиной возврата</span>
              <input
                type="file"
                name="returnFiles"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt"
                multiple
              />
              <small>Заполните причину или вложите файл.</small>
            </label>
            <div className="actions">
              <Button type="button" onClick={() => setReturnRecommendation(null)}>
                Отмена
              </Button>
              <Button primary type="submit">Вернуть на доработку</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
