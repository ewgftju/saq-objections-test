import { useState } from "react";
import { Button, Modal } from "../../../components/ui";
import type { CaseDocument, ObjectionCase, Role } from "../../../types";
import { formatDate } from "../../../utils/dateFormat";
import { downloadFile } from "../../../utils/download";
import { wordDocumentHtml } from "./DocumentModal";

const stageLabels = {
  protocol: "Формирование протокола",
  "decision-project": "Формирование проекта решения",
  "motivated-response": "Формирование мотивированного ответа",
};

export function commissionCanViewCertificate(document: CaseDocument) {
  return document.kind !== "certificate" || document.name === "Справка по результатам изучения и анализа возражения";
}

export function CertificateDocuments({ c, role, onDocument }: { c: ObjectionCase; role: Role; onDocument: (kind: string, document?: CaseDocument) => void }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const certificates = c.documents.filter((document) => document.kind === "certificate" && (role !== "commission" || commissionCanViewCertificate(document)));
  const changed = certificates.filter((document) => document.certificateVersion || /\. Версия \d+$/u.test(document.name));
  const originals = certificates.filter((document) => !changed.includes(document));
  const latest = changed.at(-1);
  const showHistory = role === "work" || role === "director" || role === "demo-superuser";
  const actions = (document: CaseDocument) => <div className="request-document-actions">
    <Button onClick={() => onDocument(document.kind, document)}>Просмотр</Button>
    <Button onClick={() => downloadFile(`${c.id}-${document.name}.doc`, wordDocumentHtml({ c, kind: document.kind, document }), "application/msword")}>Скачать Word</Button>
  </div>;
  if (!certificates.length) return null;
  return <section className="request-documents-section">
    <h4>Справка</h4>
    <div className="request-documents-list">
      {latest && <div className="request-document-row">
        <span>Справка с учётом изменений доводов ДАВГА</span>
        <div className="request-document-actions">
          <Button onClick={() => onDocument(latest.kind, latest)}>Просмотр</Button>
          <Button onClick={() => downloadFile(`${c.id}-${latest.name}.doc`, wordDocumentHtml({ c, kind: latest.kind, document: latest }), "application/msword")}>Скачать Word</Button>
          {showHistory && <Button onClick={() => setHistoryOpen(true)}>История версий</Button>}
        </div>
      </div>}
      {[...originals].reverse().map((document, index) => <div className="request-document-row" key={`${document.name}-${document.date}-${index}`}>
        <span>{document.name}</span>{actions(document)}
      </div>)}
    </div>
    {historyOpen && showHistory && <Modal title="История версий справки" wide onClose={() => setHistoryOpen(false)}>
      <div style={{ overflowX: "auto" }}><table className="data-table" style={{ minWidth: 620 }}>
        <thead><tr><th>Версия</th><th>Этап</th><th>Дата и время</th><th>Действия</th></tr></thead>
        <tbody>{changed.map((document, index) => ({ document, number: index + 1 })).reverse().map(({ document, number }) => {
          const info = document.certificateVersion;
          const timestamp = info?.createdAt ? new Date(info.createdAt) : null;
          return <tr key={`${document.name}-${number}`}>
            <td>Версия {number}</td>
            <td>{info ? stageLabels[info.stage] : "Этап не указан"}{info && <small style={{ display: "block" }}>Предложил: {info.proposedBy}<br />Принял: {info.approvedBy}</small>}</td>
            <td>{timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.toLocaleString("ru-RU") : `${formatDate(document.date)} (время не указано)`}</td>
            <td>{actions(document)}</td>
          </tr>;
        })}</tbody>
      </table></div>
    </Modal>}
  </section>;
}
