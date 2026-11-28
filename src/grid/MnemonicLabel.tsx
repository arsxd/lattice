export function MnemonicLabel({
  label,
  letter,
}: {
  label: string;
  letter: string;
}) {
  const index = label.toLowerCase().indexOf(letter.toLowerCase());
  if (index < 0) return label;
  return (
    <span>
      {label.slice(0, index)}
      <span className="mnemonic-letter">{label[index]}</span>
      {label.slice(index + 1)}
    </span>
  );
}

export function mnemonicLetter(
  event: Pick<KeyboardEvent, "key" | "code" | "altKey">,
) {
  if (/^[a-z]$/i.test(event.key)) return event.key.toUpperCase();
  if (event.altKey && /^Key[A-Z]$/.test(event.code)) return event.code.slice(3);
  return null;
}
