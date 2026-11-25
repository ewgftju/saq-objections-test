import { useEffect, useId, useRef, useState } from "react";

type PointOption = { id: string; number: string; title: string };

const searchText = (value: string) => value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/\s+/g, " ").trim();

export default function AuditReportPointPicker({ points, onSelect, disabled = false }: {
  points: PointOption[];
  onSelect: (pointId: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState(0);
  const activeOption = useRef<HTMLButtonElement>(null);
  const matches = points.filter(point => searchText(`№ ${point.number}. ${point.title}`).includes(searchText(query)));
  const activeIndex = Math.min(active, Math.max(matches.length - 1, 0));
  const expanded = open && !disabled;

  useEffect(() => {
    if (expanded) activeOption.current?.scrollIntoView({ block: "nearest" });
  }, [expanded, activeIndex, query]);

  return <div className="field subject-audit-point-picker" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <span><label htmlFor={inputId}>Пункт аудиторского отчёта <span className="required">*</span></label></span>
    <div className="subject-audit-picker-control">
      <svg className="subject-audit-picker-search" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
      <input id={inputId} className="subject-audit-picker-input" type="search" autoFocus autoComplete="off" disabled={disabled}
        role="combobox" aria-label="Выберите пункт аудиторского отчёта" aria-autocomplete="list" aria-required="true" aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined} aria-activedescendant={expanded && matches[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        value={query} placeholder="Поиск по номеру или наименованию пункта"
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
        onChange={event => { setQuery(event.currentTarget.value); setActive(0); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive(expanded ? Math.min(activeIndex + 1, Math.max(matches.length - 1, 0)) : 0);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive(expanded ? Math.max(activeIndex - 1, 0) : Math.max(matches.length - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (expanded && matches[activeIndex]) onSelect(matches[activeIndex].id);
            else setOpen(true);
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }} />
      <svg className={`subject-audit-picker-chevron${expanded ? " expanded" : ""}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
    </div>
    {expanded && <div className="subject-audit-picker-panel">
      <div className="subject-audit-picker-count" role="status">{query.trim() ? "Найдено пунктов" : "Доступно пунктов"}: {matches.length}</div>
      <div className="subject-audit-picker-options" id={listId} role="listbox" aria-label="Пункты аудиторского отчёта">
        {matches.map((point, index) => <button key={point.id} id={`${listId}-${index}`} ref={index === activeIndex ? activeOption : undefined}
          className={`subject-audit-picker-option${index === activeIndex ? " active" : ""}`} type="button" role="option" tabIndex={-1}
          aria-selected={index === activeIndex} aria-label={`Пункт № ${point.number}. ${point.title}`}
          onMouseDown={event => event.preventDefault()} onClick={() => onSelect(point.id)}>
          <span className="subject-audit-picker-number">№ {point.number}</span>
          <span className="subject-audit-picker-title">{point.title}</span>
        </button>)}
      </div>
      {!matches.length && <div className="subject-audit-picker-empty">Пункты не найдены. Измените номер или наименование.</div>}
    </div>}
  </div>;
}
