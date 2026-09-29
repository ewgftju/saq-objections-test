import { useState } from "react";
import { Button, Modal, Notice, PageHeading } from "../../../components/ui";
import type { CaseRecommendation } from "../../../types";

const EXECUTION_RESULT_OPTIONS = [
  "Заключение КК второго уровня с указанием номера и даты",
  "Признано соответствующим/не признано соответствующим",
  "Дата и номер аудиторского отчета (перепроверки)",
  "Дис. ответственность и иные меры реагирования",
  "Изменения в НПА/др",
] as const;

export default function RecommendationsPage({
  recommendations,
  onOpenCase,
  onExecute,
}: {
  recommendations: CaseRecommendation[];
  onOpenCase: (caseId: string) => void;
  onExecute: (
    recommendationId: string,
    answer: string,
    executionResult: string,
  ) => void;
}) {
  const [selected, setSelected] = useState<CaseRecommendation | null>(null);

  return (
    <>
      <PageHeading
        title="Рекомендации"
        subtitle="Рекомендации, сформированные в протоколах заседаний"
      />
      {recommendations.length === 0 ? (
        <Notice>Рекомендаций пока нет.</Notice>
      ) : (
        <section className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Текст рекомендации</th>
                  <th>Кому направлена рекомендация</th>
                  <th>Статус</th>
                  <th>Ответ</th>
                  <th>Связка с обращением</th>
                  <th>Исполнитель рабочего органа</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recommendations.map((recommendation) => (
                  <tr key={recommendation.id}>
                    <td>{recommendation.text}</td>
                    <td>{recommendation.recipient}</td>
                    <td>
                      <span className={`badge ${recommendation.status === "executed" ? "green" : "blue"}`}>
                        {recommendation.status === "executed" ? "Исполнен" : "Направлен"}
                      </span>
                    </td>
                    <td>
                      {recommendation.executionResult && (
                        <>
                          <b>{recommendation.executionResult}</b>
                          {recommendation.answer && <br />}
                        </>
                      )}
                      {recommendation.answer || "—"}
                    </td>
                    <td>
                      <Button onClick={() => onOpenCase(recommendation.caseId)}>
                        {recommendation.caseReference}
                      </Button>
                    </td>
                    <td>{recommendation.executor}</td>
                    <td>
                      {recommendation.status === "sent" && (
                        <Button primary onClick={() => setSelected(recommendation)}>
                          Внести ответ
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {selected && (
        <Modal title="Исполнение рекомендации" onClose={() => setSelected(null)}>
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              const answer = String(
                new FormData(event.currentTarget).get("answer") || "",
              ).trim();
              const executionResult = String(
                new FormData(event.currentTarget).get("executionResult") || "",
              ).trim();
              if (!answer || !executionResult) return;
              onExecute(selected.id, answer, executionResult);
              setSelected(null);
            }}
          >
            <label className="field">
              <span>Результат исполнения рекомендации <span className="required">*</span></span>
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
            <div className="actions">
              <Button type="button" onClick={() => setSelected(null)}>Отмена</Button>
              <Button primary type="submit">Зафиксировать исполнение</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
