import { useEffect, useId, useState } from "react";

export function SourceFormatButton({
  label,
  description,
  disabled,
  onClick,
}: {
  label: string;
  description: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const id = useId();
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  useEffect(() => {
    if (!position) return;
    const hide = () => setPosition(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [position]);
  const show = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setPosition({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - 252)),
      top: rect.bottom + 6,
    });
  };
  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- wrapper only shows the tooltip for the inner button
    <span
      className="source-format-option"
      onMouseEnter={(event) => show(event.currentTarget)}
      onMouseLeave={() => setPosition(null)}
      onFocus={(event) => show(event.currentTarget)}
      onBlur={() => setPosition(null)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && position) {
          event.preventDefault();
          event.stopPropagation();
          setPosition(null);
        }
      }}
    >
      <button disabled={disabled} aria-describedby={id} onClick={onClick}>
        {label}
      </button>
      <span
        id={id}
        role="tooltip"
        className="source-format-hint"
        hidden={!position || disabled}
        style={position ?? undefined}
      >
        {description}
      </span>
    </span>
  );
}
