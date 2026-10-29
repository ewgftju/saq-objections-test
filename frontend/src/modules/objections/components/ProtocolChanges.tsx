import type { ProtocolVersion } from "../../../types";
import { OUTCOMES } from "../../../data/constants";
import { normalizeVoteChoice } from "../services/decisions";

function highlighted(text: string, other: string, color: string) {
  let start = 0;
  while (start < text.length && start < other.length && text[start] === other[start]) start++;
  let end = 0;
  while (end < text.length - start && end < other.length - start && text[text.length - end - 1] === other[other.length - end - 1]) end++;
  return <>{text.slice(0, start)}<mark style={{ background: color }}>{text.slice(start, text.length - end)}</mark>{end ? text.slice(-end) : ""}</>;
}

export function ProtocolChanges({ version }: { version: ProtocolVersion }) {
  const changes = version.rows.filter((row) => row.original !== row.edited);
  if (!changes.length) return <p>Обоснования соответствуют справке.</p>;
  return <details>
    <summary>Изменены обоснования: {changes.length} · Посмотреть изменения</summary>
    <p>Изменил: {version.author} · {new Date(version.createdAt).toLocaleString("ru-RU")}</p>
    {changes.map((row) => <section key={`${row.pointId}-${row.memberId}`} style={{ border: "1px solid #dce5ed", borderRadius: 8, padding: 12, margin: "10px 0" }}>
      <strong>Пункт № {row.pointNumber} · {row.memberName}</strong>
      <p>Голос: {normalizeVoteChoice(row.vote) ? OUTCOMES[normalizeVoteChoice(row.vote) as keyof typeof OUTCOMES] : "—"}</p>
      {row.changedAt && <p>Изменил: {row.changedBy} · {new Date(row.changedAt).toLocaleString("ru-RU")}</p>}
      <p style={{ whiteSpace: "pre-wrap" }}><b>Из справки: </b>{highlighted(row.original, row.edited, "#ffe1e1")}</p>
      <p style={{ whiteSpace: "pre-wrap" }}><b>В протоколе: </b>{highlighted(row.edited, row.original, "#dbf1ff")}</p>
    </section>)}
  </details>;
}
