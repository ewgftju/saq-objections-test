import { Fragment, useState } from "react";
import type { CaseStatus, ProtocolVersion } from "../../../types";
import { ProtocolChanges } from "./ProtocolChanges";

export function ProtocolVersions({ versions, status }: { versions: ProtocolVersion[]; status: CaseStatus }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const ordered = versions.map((version, index) => ({ version, index })).reverse();
  return <section className="request-documents-section">
    <h4>Версии протокола</h4>
    <div style={{ overflowX: "auto" }}>
      <table className="data-table" style={{ minWidth: 420 }}>
        <thead><tr><th>Версия</th><th>Статус</th><th>Действие</th></tr></thead>
        <tbody>{ordered.map(({ version, index }) => {
          const statusLabel = version.signedAt ? "Подписана" : version.returnedAt ? "Возвращена на доработку" : index === versions.length - 1 && status === "protocol" ? "На подписании" : "Сформирована";
          const isOpen = expanded === index;
          return <Fragment key={`${version.createdAt}-${index}`}>
            <tr>
              <td>Версия {index + 1}</td>
              <td>{statusLabel}</td>
              <td><button className="button" type="button" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : index)}>{isOpen ? "Скрыть" : "Посмотреть"}</button></td>
            </tr>
            {isOpen && <tr><td colSpan={3}>
              <strong>Версия {index + 1}</strong>
              {version.returnComment && <p><b>Замечание при возврате:</b> {version.returnComment}</p>}
              <ProtocolChanges version={version} expanded />
            </td></tr>}
          </Fragment>;
        })}</tbody>
      </table>
    </div>
  </section>;
}
