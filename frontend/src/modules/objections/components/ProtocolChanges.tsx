import type { ProtocolReview } from "../../../types";
import { OUTCOMES } from "../../../data/constants";

function changedText(original: string, revised: string) {
  let start = 0;
  while (start < original.length && start < revised.length && original[start] === revised[start]) start++;
  let end = 0;
  while (end < original.length - start && end < revised.length - start && original[original.length - 1 - end] === revised[revised.length - 1 - end]) end++;
  return { start, end };
}

function timestamp(value?: string) {
  return value ? new Date(value).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }) : "—";
}

export default function ProtocolChanges({ reviews }: { reviews: ProtocolReview[] }) {
  const relevant = reviews.filter((review) => review.changes.length > 0);
  if (!relevant.length) return null;
  return (
    <div className="protocol-change-reviews">
      {relevant.map((review, index) => (
        <details key={`${review.createdAt}-${index}`}>
          <summary>В протоколе изменены обоснования: {review.changes.length} — посмотреть изменения</summary>
          <p>Статус: {review.status === "signed" ? "Подписан" : review.status === "returned" ? "Возвращён на доработку" : "На подписании"}{review.decidedAt ? ` · ${review.decidedBy} · ${timestamp(review.decidedAt)}` : ""}</p>
          {review.comment && <p>Замечание директора: {review.comment}</p>}
          {review.changes.map((change) => {
            const { start, end } = changedText(change.original, change.revised);
            const before = change.original.slice(0, start);
            const after = end ? change.original.slice(-end) : "";
            return (
              <section key={`${change.pointId}-${change.memberId}`} className="protocol-change-card">
                <h4>Пункт № {change.pointNumber} · {change.memberName}</h4>
                <p>Голос: {OUTCOMES[change.vote as keyof typeof OUTCOMES] || change.vote}</p>
                <p>Изменил: {change.author} · {timestamp(change.changedAt)}</p>
                <div className="protocol-change-text"><b>Из справки</b><p>{before}<del>{change.original.slice(start, end ? -end : undefined)}</del>{after}</p></div>
                <div className="protocol-change-text"><b>Для протокола</b><p>{before}<mark>{change.revised.slice(start, end ? -end : undefined)}</mark>{after}</p></div>
              </section>
            );
          })}
        </details>
      ))}
    </div>
  );
}
