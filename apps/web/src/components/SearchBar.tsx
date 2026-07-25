import { FormEvent, useState } from "react";
import { parseQuery, ParseError } from "@carma/shared";

interface Props {
  /** Called with the (trimmed) query on submit, or "" on clear. */
  onSearch: (q: string) => void;
}

/**
 * Advanced (typed) search box. Validates input live against the shared boolean
 * grammar and only submits well-formed queries. The visual query builder will
 * later feed this same string contract.
 */
export function SearchBar({ onSearch }: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  /** Validate `value`; set/clear the error and return whether it's valid. */
  function validate(value: string): boolean {
    try {
      parseQuery(value); // empty/whitespace -> null (valid, no filter)
      setError(null);
      return true;
    } catch (err) {
      setError(
        err instanceof ParseError
          ? `${err.message} (position ${err.position + 1})`
          : "Invalid query",
      );
      return false;
    }
  }

  function handleChange(value: string) {
    setText(value);
    validate(value);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (validate(text)) onSearch(text.trim());
  }

  function handleClear() {
    setText("");
    setError(null);
    onSearch("");
  }

  const invalid = error !== null;

  return (
    <form className="search" onSubmit={handleSubmit}>
      <div className="search-row">
        <input
          type="text"
          className={invalid ? "search-input invalid" : "search-input"}
          placeholder={'Search… e.g.  "oil prices" AND renew*'}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          aria-invalid={invalid}
          aria-label="Search query"
        />
        <button type="submit" disabled={invalid}>
          Search
        </button>
        <button type="button" onClick={handleClear} disabled={text === ""}>
          Clear
        </button>
      </div>
      {invalid ? (
        <p className="search-error">{error}</p>
      ) : (
        <p className="search-hint">
          <code>AND</code> <code>OR</code> <code>AND NOT</code> · groups{" "}
          <code>( )</code> · phrase <code>"…"</code> · wildcard <code>term*</code>
        </p>
      )}
    </form>
  );
}
