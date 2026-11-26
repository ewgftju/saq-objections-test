import { useRef, useState } from "react";
import { Button } from "../../../components/ui";
import type { DocumentLanguage, ObjectionCase, SubjectAuditReport } from "../../../types";
import { formatDate } from "../../../utils/dateFormat";
import { findWorkAuditReports } from "../services/subjectAppeals";

interface Props {
  cases: readonly ObjectionCase[];
  report?: SubjectAuditReport;
  language: DocumentLanguage;
  onSelect: (report: SubjectAuditReport) => void;
  onClear: () => boolean;
}

export default function WorkAuditReportLookup({ cases, report, language, onSelect, onClear }: Props) {
  const [number, setNumber] = useState(report?.number ?? "");
  const [matches, setMatches] = useState<SubjectAuditReport[] | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const select = (item: SubjectAuditReport) => {
    setNumber(item.number);
    setMatches(null);
    onSelect(item);
  };
  const search = () => {
    const found = findWorkAuditReports(cases, number);
    if (found.length === 1) select(found[0]);
    else setMatches(found);
  };

  return <>
    <div className="field">
      <span><label htmlFor="work-audit-number">Номер: Аудиторский отчет <span className="required">*</span></label></span>
      <div className="work-audit-number">
        <input id="work-audit-number" ref={input} name="documentNumber" required readOnly={!!report} placeholder="Например, 1-АО"
          value={number} onChange={event => { setNumber(event.target.value); setMatches(null); }}
          onKeyDown={event => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (!report && number.trim()) search();
            }
          }} />
        {report
          ? <Button onClick={() => { if (onClear()) { input.current?.focus(); input.current?.select(); } }}>Сменить</Button>
          : <Button disabled={!number.trim()} onClick={search}>Найти</Button>}
      </div>
    </div>
    <label className="field">
      <span>Дата: Аудиторский отчет <span className="required">*</span></span>
      <input name="documentDate" type="date" required readOnly value={report?.date ?? ""} />
    </label>
    {report && <p className="work-audit-status" role="status">
      {report.orgTranslations?.[language] || report.org} · {report.identifierType} {report.bin}
      {!report.points.length && " · В отчёте отсутствуют пункты для выбора."}
    </p>}
    {matches && <div className="work-audit-results">
      <p role="status">{matches.length ? "Найдено несколько отчётов. Выберите нужный." : "Аудиторский отчёт с таким номером не найден. Проверьте номер и повторите поиск."}</p>
      {matches.map(item => <Button key={item.sourceCaseId} onClick={() => select(item)}>
        <strong>№ {item.number} от {formatDate(item.date)}</strong>
        <span>{item.orgTranslations?.[language] || item.org} · {item.identifierType} {item.bin} · {item.issuer}</span>
      </Button>)}
    </div>}
  </>;
}
