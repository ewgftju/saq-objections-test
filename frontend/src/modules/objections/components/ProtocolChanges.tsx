import type { ProtocolVersion } from "../../../types";
import { Fragment } from "react";
import { OUTCOMES } from "../../../data/constants";
import { normalizeVoteChoice } from "../services/decisions";
import { protocolDavgaFromReason, replaceProtocolDavga } from "../services/protocolReason";

function highlighted(text: string, other: string, color: string, deleted = false) {
  const left = text.match(/\s+|[^\s]+/g) ?? [];
  const right = other.match(/\s+|[^\s]+/g) ?? [];
  const width = right.length + 1;
  if (left.length * right.length > 250_000) {
    let start = 0;
    while (start < text.length && start < other.length && text[start] === other[start]) start++;
    let end = 0;
    while (end < text.length - start && end < other.length - start && text[text.length - end - 1] === other[other.length - end - 1]) end++;
    return <>{text.slice(0, start)}<mark style={{ background: color, textDecoration: deleted ? "line-through" : undefined }}>{text.slice(start, text.length - end)}</mark>{end ? text.slice(-end) : ""}</>;
  }
  const lengths = new Uint32Array((left.length + 1) * width);
  for (let i = left.length - 1; i >= 0; i--) for (let j = right.length - 1; j >= 0; j--) {
    lengths[i * width + j] = left[i] === right[j] ? 1 + lengths[(i + 1) * width + j + 1] : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
  }
  const parts: Array<{ text: string; changed: boolean }> = [];
  let i = 0, j = 0;
  const append = (value: string, changed: boolean) => {
    const last = parts.at(-1);
    if (last?.changed === changed) last.text += value;
    else parts.push({ text: value, changed });
  };
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { append(left[i++], false); j++; }
    else if (lengths[(i + 1) * width + j] >= lengths[i * width + j + 1]) append(left[i++], true);
    else j++;
  }
  while (i < left.length) append(left[i++], true);
  return <>{parts.map((part, index) => part.changed
    ? <mark key={index} style={{ background: color, color: deleted ? "#a63d45" : "#1765b5", textDecoration: deleted ? "line-through" : undefined }}>{part.text}</mark>
    : <Fragment key={index}>{part.text}</Fragment>)}</>;
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
      <p style={{ whiteSpace: "pre-wrap" }}><b>Было · Доводы ДАВГА из справки</b><br />{point.variants.size === 1 ? highlighted(point.original || "—", [...point.variants.keys()][0] || "—", "#ffe1e1", true) : point.original || "—"}</p>
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
              <p style={{ whiteSpace: "pre-wrap" }}><b>Из справки: </b>{highlighted(row.original, row.edited, "#ffe1e1", true)}</p>
              <p style={{ whiteSpace: "pre-wrap" }}><b>В протоколе: </b>{highlighted(row.edited, row.original, "#dbf1ff")}</p>
            </details>}
          </div>;
        })}
        {point.variants.size > 1 && <p style={{ whiteSpace: "pre-wrap" }}><b>Было</b><br />{highlighted(point.original || "—", edited || "—", "#ffe1e1", true)}</p>}
        <p style={{ whiteSpace: "pre-wrap" }}><b>Стало</b><br />{highlighted(edited || "—", point.original || "—", "#dbf1ff")}</p>
      </div>)}
    </section>)}
  </details>;
}
