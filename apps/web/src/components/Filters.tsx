import { useState } from "react";
import { Language, Source } from "@carma/shared";

/** The filter values this control emits (dates are `yyyy-mm-dd` or null). */
export interface FilterValue {
  sourceId: number | null;
  languageId: number | null;
  from: string | null;
  to: string | null;
}

interface Props {
  sources: Source[];
  languages: Language[];
  onChange: (value: FilterValue) => void;
}

/**
 * Source + language dropdowns and an independent from/to date range. Either date
 * may be left empty; if both are set, `to` must be on or after `from` — an
 * invalid range shows an error and is not applied (other changes still apply).
 */
export function Filters({ sources, languages, onChange }: Props) {
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [languageId, setLanguageId] = useState<number | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rangeInvalid = from !== "" && to !== "" && to < from;

  // Apply the current selection. Source/language always take effect; an invalid
  // date range simply contributes no date filter (the error message flags it),
  // so changing a dropdown is never silently dropped by a broken range.
  function apply(next: {
    sourceId: number | null;
    languageId: number | null;
    from: string;
    to: string;
  }) {
    const invalid = next.from !== "" && next.to !== "" && next.to < next.from;
    onChange({
      sourceId: next.sourceId,
      languageId: next.languageId,
      from: invalid ? null : next.from || null,
      to: invalid ? null : next.to || null,
    });
  }

  function onSource(value: string) {
    const id = value === "" ? null : Number(value);
    setSourceId(id);
    apply({ sourceId: id, languageId, from, to });
  }
  function onLanguage(value: string) {
    const id = value === "" ? null : Number(value);
    setLanguageId(id);
    apply({ sourceId, languageId: id, from, to });
  }
  function onFrom(value: string) {
    setFrom(value);
    apply({ sourceId, languageId, from: value, to });
  }
  function onTo(value: string) {
    setTo(value);
    apply({ sourceId, languageId, from, to: value });
  }
  function clear() {
    setSourceId(null);
    setLanguageId(null);
    setFrom("");
    setTo("");
    onChange({ sourceId: null, languageId: null, from: null, to: null });
  }

  const active =
    sourceId !== null || languageId !== null || from !== "" || to !== "";

  return (
    <div className="filters">
      <div className="filters-row">
        <label className="field">
          <span>Source</span>
          <select value={sourceId ?? ""} onChange={(e) => onSource(e.target.value)}>
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Language</span>
          <select value={languageId ?? ""} onChange={(e) => onLanguage(e.target.value)}>
            <option value="">All languages</option>
            {languages.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>From</span>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => onFrom(e.target.value)}
            aria-invalid={rangeInvalid}
          />
        </label>

        <label className="field">
          <span>To</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => onTo(e.target.value)}
            aria-invalid={rangeInvalid}
          />
        </label>

        <button type="button" className="filters-clear" onClick={clear} disabled={!active}>
          Clear filters
        </button>
      </div>
      {rangeInvalid && (
        <p className="filters-error">‘To’ date must be on or after ‘From’ date.</p>
      )}
    </div>
  );
}
