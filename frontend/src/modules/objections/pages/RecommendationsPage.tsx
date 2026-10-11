import { useState } from "react";
import { Button, Modal, Notice, PageHeading } from "../../../components/ui";
import { ROLES } from "../../../data/constants";
import type { CaseRecommendation, Role } from "../../../types";
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
  sent: "Направлена",
  answered: "Ответ получен",
  executed: "Исполнена",
  returned: "Возвращена на доработку",
};

function statusTone(status: CaseRecommendation["status"]) {
  if (status === "executed") return "green";
  if (status === "returned") return "amber";
  return "blue";
}

export default function RecommendationsPage({
  recommendations,
  role,
  onOpenCase,
  onSubmitResponse,
  onAcceptResponse,
  onReturnForRevision,
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
  ) => void;
}) {
  const [responseRecommendation, setResponseRecommendation] =
    useState<CaseRecommendation | null>(null);
  const [returnRecommendation, setReturnRecommendation] =
    useState<CaseRecommendation | null>(null);
  const isWork = role === "demo-superuser" || role === "work";
  const visibleRecommendations = isWork
    ? recommendations
    : recommendations.filter(
        (recommendation) =>
          recommendation.recipientRole === role ||
          (!recommendation.recipientRole &&
            recommendation.recipient === ROLES[role]),
      );

  return (
    <>
      <PageHeading
        title="Рекомендации"
        subtitle={
          isWork
            ? "Направленные рекомендации и контроль их исполнения"
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
                  <th>Текст рекомендации</th>
                  <th>Кому направлена рекомендация</th>
                  <th>Способ направления</th>
                  <th>Дата направления</th>
                  <th>Срок исполнения</th>
                  <th>Результат исполнения</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleRecommendations.map((recommendation, index) => {
                  const canRespond =
                    (role === "demo-superuser" ||
                      role === recommendation.recipientRole) &&
                    recommendation.status !== "executed" &&
                    recommendation.channel !== "external";
                  const canReview =
                    isWork && recommendation.status === "answered";
                  return (
                    <tr key={recommendation.id}>
                      <td>{index + 1}</td>
                      <td>{recommendation.text}</td>
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
                          {STATUS_LABELS[recommendation.status]}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
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
                                  ? "Доработать ответ"
                                  : "Внести ответ"}
                              </Button>
                            )}
                          {canReview && (
                            <>
                              <Button
                                primary
                                onClick={() => onAcceptResponse(recommendation.id)}
                              >
                                Принять ответ
                              </Button>
                              <Button onClick={() => setReturnRecommendation(recommendation)}>
                                Вернуть на доработку
                              </Button>
                            </>
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
            onSubmit={(event) => {
              event.preventDefault();
              const revisionDueDate = String(
                new FormData(event.currentTarget).get("revisionDueDate") || "",
              );
              if (!revisionDueDate) return;
              onReturnForRevision(returnRecommendation.id, revisionDueDate);
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
