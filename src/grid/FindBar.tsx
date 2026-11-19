type Props = {
  id?: string;
  label?: string;
  value: string;
  disabled?: boolean;
  inputDisabled?: boolean;
  count: number;
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
      <input
        id={p.id}
        type="search"
        aria-label={p.label ?? "Find in table"}
        placeholder="Find in this table…"
        value={p.value}
        disabled={p.inputDisabled}
        onChange={(e) => p.onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            p.onNavigate(e.shiftKey ? -1 : 1);
          }
        }}
      />
      {!!p.value && (
        <>
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
            title="Number of matching cells"
          >
            {p.index !== undefined ? `${p.index + 1} / ` : ""}
            {p.count} {p.count === 1 ? "cell" : "cells"}
          </output>
          <button
            type="button"
            title="Previous result (Shift+Enter)"
            aria-label="Previous search result"
            disabled={p.disabled || !p.count}
            onClick={() => p.onNavigate(-1)}
          >
            ↑
          </button>
          <button
            type="button"
            title="Next result (Enter)"
            aria-label="Next search result"
            disabled={p.disabled || !p.count}
            onClick={() => p.onNavigate(1)}
          >
            ↓
          </button>
        </>
      )}
    </div>
  );
}
