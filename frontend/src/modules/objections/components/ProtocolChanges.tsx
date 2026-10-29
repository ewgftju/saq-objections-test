import { Fragment } from "react";
import type { ProtocolVersion } from "../../../types";
import { OUTCOMES } from "../../../data/constants";
import { normalizeVoteChoice } from "../services/decisions";

type DiffPart = { text: string; kind: "same" | "removed" | "added" };

function compareText(original: string, edited: string): DiffPart[] {
  const before = original.match(/\s+|[^\s]+/g) ?? [];
  const after = edited.match(/\s+|[^\s]+/g) ?? [];
  const width = after.length + 1;
  const parts: DiffPart[] = [];
  const append = (text: string, kind: DiffPart["kind"]) => {
    if (!text) return;
    const previous = parts.at(-1);
    if (previous?.kind === kind) previous.text += text;
    else parts.push({ text, kind });
  };
  if (before.length * after.length > 250_000) {
    let prefix = 0;
    while (prefix < original.length && prefix < edited.length && original[prefix] === edited[prefix]) prefix++;
    let suffix = 0;
    while (suffix < original.length - prefix && suffix < edited.length - prefix && original[original.length - suffix - 1] === edited[edited.length - suffix - 1]) suffix++;
    append(original.slice(0, prefix), "same");
    append(original.slice(prefix, original.length - suffix), "removed");
    append(edited.slice(prefix, edited.length - suffix), "added");
    if (suffix) append(original.slice(-suffix), "same");
    return parts;
  }
  const lengths = new Uint32Array((before.length + 1) * width);
  for (let i = before.length - 1; i >= 0; i--) for (let j = after.length - 1; j >= 0; j--) {
    lengths[i * width + j] = before[i] === after[j] ? 1 + lengths[(i + 1) * width + j + 1] : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
  }
  let i = 0, j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) { append(before[i++], "same"); j++; }
    else if (lengths[(i + 1) * width + j] >= lengths[i * width + j + 1]) append(before[i++], "removed");
    else append(after[j++], "added");
  }
  while (i < before.length) append(before[i++], "removed");
  while (j < after.length) append(after[j++], "added");
  return parts;
}

export function ProtocolChanges({ version }: { version: ProtocolVersion }) {
  const changes = version.rows.filter((row) => row.original !== row.edited);
  if (!changes.length) return <p>Обоснования соответствуют справке.</p>;
  const groups = new Map<string, typeof changes>();
  for (const row of changes) {
    const key = JSON.stringify([row.pointId, row.original, row.edited]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return <details>
    <summary>Изменены обоснования: {changes.length} · Посмотреть изменения</summary>
    <p><span style={{ color: "#b42318", textDecoration: "line-through" }}>Удалено</span> · <span style={{ color: "#175cd3" }}>Добавлено</span></p>
    {[...groups.entries()].map(([key, rows]) => {
      const first = rows[0];
      return <section key={key} style={{ border: "1px solid #dce5ed", borderRadius: 8, padding: 16, margin: "12px 0" }}>
        <strong>Пункт № {first.pointNumber}</strong>
        {rows.map((row) => {
          const vote = normalizeVoteChoice(row.vote);
          return <div key={`${row.pointId}-${row.memberId}`} style={{ marginTop: 8 }}>
            <strong>{row.memberName}</strong> · Голос: {vote ? OUTCOMES[vote] : "—"}
            {row.changedAt && <div>Изменил: {row.changedBy} · {new Date(row.changedAt).toLocaleString("ru-RU")}</div>}
          </div>;
        })}
        <p style={{ whiteSpace: "pre-wrap" }}><b>Обоснование протокола</b><br />{compareText(first.original, first.edited).map((part, index) => part.kind === "same"
          ? <Fragment key={index}>{part.text}</Fragment>
          : <mark key={index} title={part.kind === "removed" ? "Удалено" : "Добавлено"} style={part.kind === "removed" ? { color: "#b42318", background: "#fee4e2", textDecoration: "line-through" } : { color: "#175cd3", background: "#dbeafe" }}>{part.text}</mark>)}</p>
      </section>;
    })}
  </details>;
}
