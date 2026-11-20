type Props = { value: string; onChange: (value: string) => void };

export function ThemePicker({ value, onChange }: Props) {
  return (
    <div className="theme-picker" role="group" aria-label="Theme">
      {(["system", "light", "dark"] as const).map((theme) => (
        <button
          key={theme}
          type="button"
          title={`${theme[0].toUpperCase() + theme.slice(1)} theme`}
          aria-label={`${theme[0].toUpperCase() + theme.slice(1)} theme`}
          aria-pressed={value === theme}
          onClick={() => onChange(theme)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {theme === "system" ? (
              <>
                <rect x="3" y="4" width="18" height="13" rx="2" />
                <path d="M8 21h8m-4-4v4" />
              </>
            ) : theme === "light" ? (
              <>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" />
              </>
            ) : (
              <path d="M20.5 14a8.5 8.5 0 0 1-10.5-10.5A8.5 8.5 0 1 0 20.5 14Z" />
            )}
          </svg>
        </button>
      ))}
    </div>
  );
}
