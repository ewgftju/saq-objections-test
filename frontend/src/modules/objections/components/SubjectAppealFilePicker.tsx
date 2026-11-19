import type { ChangeEventHandler } from "react";

export function SubjectAppealFilePicker({
  count,
  required,
  disabled,
  onChange,
}: {
  count: number;
  required: boolean;
  disabled: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <span className="subject-evidence-control">
      <span className="subject-evidence-button" data-disabled={disabled}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="m21 11-8.5 8.5a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8l8.5-8.5" />
        </svg>
        <span>Выбрать файлы</span>
        <input
          type="file"
          multiple
          required={required}
          aria-required
          aria-label="Выбрать файлы доказательств"
          disabled={disabled}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
          onChange={onChange}
        />
      </span>
      <span className="subject-evidence-count" aria-live="polite">
        {count ? `Файлов: ${count}` : "Файлы не выбраны"}
      </span>
    </span>
  );
}
