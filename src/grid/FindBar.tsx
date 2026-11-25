import { ColumnMenuChevron } from "./SheetIcons";
type Props = {
  id?: string;
  label?: string;
  value: string;
  disabled?: boolean;
  inputDisabled?: boolean;
  count: number;
  headerCount?: number;
  index?: number;
  caseSensitive: boolean;
  wholeWord: boolean;
  onChange: (value: string) => void;
  onCase: () => void;
  onWord: () => void;
  onNavigate: (direction: number) => void;
};
export function FindBar(p: Props) {
  return (
    <div className="find-bar" role="group" aria-label="Find in table">
      <span className="find-field">
        <input
          id={p.id}
          type="text"
          role="searchbox"
          autoComplete="off"
          spellCheck={false}
          aria-label={p.label ?? "Find in table"}
          placeholder="Find in this table…"
          value={p.value}
          disabled={p.inputDisabled}
          onChange={(e) => p.onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              p.onNavigate(e.shiftKey ? -1 : 1);
            } else if (e.key === "Escape" && p.value) {
              e.preventDefault();
              p.onChange("");
            }
          }}
        />
        {!!p.value && (
          <button
            type="button"
            className="find-clear"
            title="Clear search (Esc)"
            aria-label="Clear search"
            disabled={p.disabled}
            onClick={() => {
              p.onChange("");
              document.getElementById(p.id ?? "find")?.focus();
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path
                d="M2.5 2.5l7 7M9.5 2.5l-7 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
        )}
      </span>
      <span
        className="find-tools"
        style={{ visibility: p.value ? "visible" : "hidden" }}
      >
        <button
          type="button"
          title="Match case"
          aria-label="Match case"
          aria-pressed={p.caseSensitive}
          disabled={p.disabled}
          onClick={p.onCase}
        >
          Aa
        </button>
        <button
          type="button"
          title="Match whole word"
          aria-label="Match whole word"
          aria-pressed={p.wholeWord}
          disabled={p.disabled}
          onClick={p.onWord}
        >
          <span className="whole-word-glyph">Ab</span>
        </button>
        <output
          className="find-count"
          aria-live="polite"
          title="Number of matching cells and column names"
        >
          {p.index !== undefined ? `${p.index + 1} / ` : ""}
          {p.count} {p.count === 1 ? "cell" : "cells"}
          {p.headerCount
            ? ` · ${p.headerCount} ${p.headerCount === 1 ? "column name" : "column names"}`
            : ""}
        </output>
        <button
          type="button"
          title="Previous result (Shift+Enter)"
          aria-label="Previous search result"
          disabled={p.disabled || !p.count}
          onClick={() => p.onNavigate(-1)}
        >
          <span className="find-previous-chevron">
            <ColumnMenuChevron />
          </span>
        </button>
        <button
          type="button"
          title="Next result (Enter)"
          aria-label="Next search result"
          disabled={p.disabled || !p.count}
          onClick={() => p.onNavigate(1)}
        >
          <ColumnMenuChevron />
        </button>
      </span>
    </div>
  );
}
