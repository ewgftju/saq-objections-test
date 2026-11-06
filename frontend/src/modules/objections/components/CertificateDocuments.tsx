import { documentLanguageLabel, languagesForDocument, LANGUAGE_LABELS } from "../services/documentLanguage";
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

function certificateTitle(name: string, number?: number) {
  return number ? name.replace(/^Справка/u, `Справка № ${number}`) : name;
}

export function commissionCanViewCertificate(document: CaseDocument) {
  return document.kind !== "certificate" || document.name === "Справка по результатам изучения и анализа возражения";
}

export function CertificateDocuments({ c, role, onDocument }: { c: ObjectionCase; role: Role; onDocument: (kind: string, document?: CaseDocument) => void }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [analysisHistoryOpen, setAnalysisHistoryOpen] = useState(false);
  const certificates = c.documents.filter((document) => document.kind === "certificate" && (role !== "commission" || commissionCanViewCertificate(document)));
  const changed = certificates.filter((document) => document.certificateVersion || /\. Версия \d+$/u.test(document.name));
  const originals = certificates.filter((document) => !changed.includes(document));
  const analysisVersions = originals.filter(document => document.name === "Справка по результатам изучения и анализа возражения");
  const analysisNumber = analysisVersions.find(document => document.certificateNumber)?.certificateNumber;
  const visibleAnalysis = role === "commission" ? analysisVersions[0] : analysisVersions.at(-1);
  const analysisDocument = (document: CaseDocument) => analysisNumber ? { ...document, certificateNumber: analysisNumber } : document;
  const latest = changed.at(-1);
  const showHistory = role === "work" || role === "director" || role === "demo-superuser";
  const actions = (document: CaseDocument, showAnalysisHistory = false) => <div className="request-document-actions">
    {languagesForDocument(c, document.kind, document).map(language => <Button key={language} onClick={() => onDocument(document.kind, { ...document, viewLanguage: language })}>{languagesForDocument(c, document.kind, document).length > 1 ? `Просмотр ${language === "kk" ? "KZ" : "RU"}` : "Просмотр"}</Button>)}
    <Button onClick={() => downloadFile(`${c.id}-${document.name}.doc`, wordDocumentHtml({ c, kind: document.kind, document }), "application/msword")}>{document.languages?.length === 2 ? "Скачать комплект" : "Скачать Word"}</Button>
    {showAnalysisHistory && <Button onClick={() => setAnalysisHistoryOpen(true)}>История версий</Button>}
  </div>;
  if (!certificates.length) return null;
  return <section className="request-documents-section">
    <h4>Справка</h4>
    <div className="request-documents-list">
      {latest && <div className="request-document-row">
        <span>{certificateTitle(latest.certificateVersion?.source === "protocol-result" ? "Справка по итогам протокола заседания" : "Справка с учётом изменений доводов ДАВГА", latest.certificateNumber)}<small style={{ display: "block" }}>{documentLanguageLabel(c, latest)}</small></span>
        <div className="request-document-actions">
          {languagesForDocument(c, latest.kind, latest).map(language => <Button key={language} onClick={() => onDocument(latest.kind, { ...latest, viewLanguage: language })}>{latest.languages?.length === 2 ? `Просмотр ${language === "kk" ? "KZ" : "RU"}` : "Просмотр"}</Button>)}
          <Button onClick={() => downloadFile(`${c.id}-${latest.name}.doc`, wordDocumentHtml({ c, kind: latest.kind, document: latest }), "application/msword")}>{latest.languages?.length === 2 ? "Скачать комплект" : "Скачать Word"}</Button>
          {showHistory && <Button onClick={() => setHistoryOpen(true)}>История версий</Button>}
        </div>
      </div>}
      {[...originals].reverse().filter(document => document.name !== "Справка по результатам изучения и анализа возражения" || document === visibleAnalysis).map((document, index) => <div className="request-document-row" key={`${document.name}-${document.date}-${index}`}>
        <span>{certificateTitle(document.name, document === visibleAnalysis ? analysisNumber : document.certificateNumber)}{document === visibleAnalysis && analysisVersions.length > 1 && role !== "commission" ? ` · Версия ${analysisVersions.length}` : ""}<small style={{ display: "block" }}>{documentLanguageLabel(c, document)}</small></span>
        {document === visibleAnalysis ? actions(analysisDocument(document), showHistory && analysisVersions.length > 1) : actions(document)}
      </div>)}
    </div>
    {analysisHistoryOpen && showHistory && <Modal title="История версий справки по результатам изучения" wide onClose={() => setAnalysisHistoryOpen(false)}>
      <div style={{ overflowX: "auto" }}><table className="data-table" style={{ minWidth: 620 }}><thead><tr><th>Версия</th><th>Номер</th><th>Дата</th><th>Статус</th><th>Действия</th></tr></thead><tbody>
        {analysisVersions.map((document, index) => ({ document, number: index + 1 })).reverse().map(({ document, number }) => <tr key={`${document.date}-${number}`}><td>Версия {number}</td><td>{analysisNumber ? `№ ${analysisNumber}` : "—"}</td><td>{formatDate(document.date)}</td><td>{document.certificateNumber ? "Подписана" : "Не подписана"}</td><td>{actions(analysisDocument(document))}</td></tr>)}
      </tbody></table></div>
    </Modal>}
    {historyOpen && showHistory && <Modal title="История версий справки" wide onClose={() => setHistoryOpen(false)}>
      <div style={{ overflowX: "auto" }}><table className="data-table" style={{ minWidth: 620 }}>
        <thead><tr><th>Версия</th><th>Этап</th><th>Дата и время</th><th>Действия</th></tr></thead>
        <tbody>{changed.map((document, index) => ({ document, number: index + 1 })).reverse().map(({ document, number }) => {
          const info = document.certificateVersion;
          const timestamp = info?.createdAt ? new Date(info.createdAt) : null;
          return <tr key={`${document.name}-${number}`}>
            <td>Версия {number}</td>
            <td>{info ? stageLabels[info.stage] : "Этап не указан"}{info && <small style={{ display: "block" }}>{info.source === "protocol-result" ? <>Сформировал: {info.proposedBy}</> : <>Предложил: {info.proposedBy}<br />Принял: {info.approvedBy}</>}</small>}</td>
            <td>{timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.toLocaleString("ru-RU") : `${formatDate(document.date)} (время не указано)`}</td>
            <td>{actions(document)}</td>
          </tr>;
        })}</tbody>
      </table></div>
    </Modal>}
  </section>;
}
