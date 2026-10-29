import { Fragment } from "react";
import type { ProtocolVersion } from "../../../types";
import { OUTCOMES } from "../../../data/constants";
import { normalizeVoteChoice } from "../services/decisions";

type DiffPart = { text: string; kind: "same" | "removed" | "added" };

function davgaText(reason: string) {
  const label = /(?:Доводы рабочего органа\s*\(ДАВГА МФ РК\)|Доводы ДАВГА)\s*:\s*/gi;
  let match: RegExpExecArray | null;
  let start = -1;
  while ((match = label.exec(reason))) start = match.index + match[0].length;
  if (start >= 0) return reason.slice(start);
  return /(?:Доводы ДВГА|Доводы КВГА|Доводы объекта|Мотивированный ответ)/i.test(reason) ? "" : reason;
}

export function davgaChanges(version: ProtocolVersion) {
  return version.rows.map((row) => ({ ...row, original: davgaText(row.original), edited: davgaText(row.edited) }))
    .filter((row) => row.original !== row.edited);
}

function compareText(original: string, edited: string): DiffPart[] {
  const beforeAll = Array.from(original);
  const afterAll = Array.from(edited);
  let prefix = 0;
  while (prefix < beforeAll.length && prefix < afterAll.length && beforeAll[prefix] === afterAll[prefix]) prefix++;
  let suffix = 0;
  while (suffix < beforeAll.length - prefix && suffix < afterAll.length - prefix && beforeAll[beforeAll.length - suffix - 1] === afterAll[afterAll.length - suffix - 1]) suffix++;
  const before = beforeAll.slice(prefix, beforeAll.length - suffix);
  const after = afterAll.slice(prefix, afterAll.length - suffix);
  const width = after.length + 1;
  const parts: DiffPart[] = [];
  const append = (text: string, kind: DiffPart["kind"]) => {
    if (!text) return;
    const previous = parts.at(-1);
    if (previous?.kind === kind) previous.text += text;
    else parts.push({ text, kind });
  };
  append(beforeAll.slice(0, prefix).join(""), "same");
  if (before.length * after.length > 2_000_000) {
    append(before.join(""), "removed");
    append(after.join(""), "added");
    if (suffix) append(beforeAll.slice(-suffix).join(""), "same");
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
  if (suffix) append(beforeAll.slice(-suffix).join(""), "same");
  return parts;
}

export function ProtocolChanges({ version, expanded = false }: { version: ProtocolVersion; expanded?: boolean }) {
  const changes = davgaChanges(version);
  if (!changes.length) return <p>Доводы ДАВГА соответствуют справке.</p>;
  const groups = new Map<string, typeof changes>();
  for (const row of changes) {
    const key = JSON.stringify([row.pointId, row.original, row.edited]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return <details open={expanded || undefined}>
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
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="data-table" style={{ minWidth: 600, tableLayout: "fixed", width: "100%" }}>
            <thead><tr><th scope="col">Доводы ДАВГА из справки</th><th scope="col">Доводы ДАВГА из протокола</th></tr></thead>
            <tbody><tr>
              <td style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", verticalAlign: "top" }}>{first.original || "—"}</td>
              <td style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", verticalAlign: "top" }}>{compareText(first.original, first.edited).map((part, index) => part.kind === "same"
                ? <Fragment key={index}>{part.text}</Fragment>
                : <mark key={index} title={part.kind === "removed" ? "Удалено" : "Добавлено"} style={part.kind === "removed" ? { color: "#b42318", background: "#fee4e2", textDecoration: "line-through" } : { color: "#175cd3", background: "#dbeafe" }}>{part.text}</mark>)}</td>
            </tr></tbody>
          </table>
        </div>
      </section>;
    })}
  </details>;
}
