import type { ProtocolVersion } from "../../../types";
import { OUTCOMES } from "../../../data/constants";
import { normalizeVoteChoice } from "../services/decisions";
import { protocolDavgaFromReason, replaceProtocolDavga } from "../services/protocolReason";

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

  // Старые версии могут содержать разные исходные тексты даже для одного пункта.
  const points = new Map<string, { number: string | number; original: string; variants: Map<string, typeof changes> }>();
  for (const row of changes) {
    const original = protocolDavgaFromReason(row.original);
    const edited = protocolDavgaFromReason(row.edited);
    const key = JSON.stringify([row.pointId, original]);
    if (!points.has(key)) points.set(key, { number: row.pointNumber, original, variants: new Map() });
    const variants = points.get(key)!.variants;
    if (!variants.has(edited)) variants.set(edited, []);
    variants.get(edited)!.push(row);
  }

  return <details>
    <summary>Изменены обоснования: {changes.length} · Посмотреть изменения</summary>
    {[...points.entries()].map(([key, point]) => <section key={key} style={{ border: "1px solid #dce5ed", borderRadius: 8, padding: 16, margin: "12px 0" }}>
      <strong>Пункт № {point.number}</strong>
      <p style={{ whiteSpace: "pre-wrap" }}><b>Доводы ДАВГА из справки</b><br />{point.original || "—"}</p>
      <b>Изменения в протоколе</b>
      {[...point.variants.entries()].map(([edited, rows], index) => <div key={index} style={{ borderTop: "1px solid #e6edf3", marginTop: 10, paddingTop: 10 }}>
        {rows.map((row) => {
          const vote = normalizeVoteChoice(row.vote);
          const otherChanged = replaceProtocolDavga(row.original, protocolDavgaFromReason(row.original)) !== replaceProtocolDavga(row.edited, protocolDavgaFromReason(row.original));
          const legacyMissing = !row.original.includes("Доводы рабочего органа (ДАВГА МФ РК): ") || !row.edited.includes("Доводы рабочего органа (ДАВГА МФ РК): ");
          return <div key={`${row.pointId}-${row.memberId}`}>
            <strong>{row.memberName}</strong> · Голос: {vote ? OUTCOMES[vote] : "—"}
            {row.changedAt && <div>Изменил: {row.changedBy} · {new Date(row.changedAt).toLocaleString("ru-RU")}</div>}
            {(otherChanged || legacyMissing) && <details style={{ margin: "8px 0" }}>
              <summary>Другие изменения — полное сравнение</summary>
              <p style={{ whiteSpace: "pre-wrap" }}><b>Из справки: </b>{highlighted(row.original, row.edited, "#ffe1e1")}</p>
              <p style={{ whiteSpace: "pre-wrap" }}><b>В протоколе: </b>{highlighted(row.edited, row.original, "#dbf1ff")}</p>
            </details>}
          </div>;
        })}
        <p style={{ whiteSpace: "pre-wrap" }}>{highlighted(edited || "—", point.original || "—", "#dbf1ff")}</p>
      </div>)}
    </section>)}
  </details>;
}
