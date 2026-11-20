import { EditorView } from "@codemirror/view";
import {
  HighlightStyle,
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";

// Reuse the installed highlighter's public tag specs; no extra theme package.
const colors: Record<string, string> = {
  "#708": "var(--syntax-keyword)",
  "#219": "var(--syntax-keyword)",
  "#164": "var(--syntax-number)",
  "#a11": "var(--syntax-string)",
  "#e40": "var(--syntax-escape)",
  "#00f": "var(--syntax-definition)",
  "#00c": "var(--syntax-definition)",
  "#30a": "var(--syntax-definition)",
  "#085": "var(--syntax-definition)",
  "#167": "var(--syntax-definition)",
  "#256": "var(--syntax-definition)",
  "#404740": "var(--syntax-comment)",
  "#940": "var(--syntax-comment)",
  "#f00": "var(--error)",
};
const darkHighlighting = syntaxHighlighting(
  HighlightStyle.define(
    defaultHighlightStyle.specs.map((spec) =>
      typeof spec.color === "string"
        ? { ...spec, color: colors[spec.color] ?? "var(--text)" }
        : spec,
    ),
    { themeType: "dark" },
  ),
);
export function editorTheme(dark: boolean) {
  return [
    darkHighlighting,
    EditorView.theme(
      {
        "&": { backgroundColor: "var(--surface)", color: "var(--text)" },
        ".cm-content": { caretColor: "var(--text)" },
        ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--text)" },
        ".cm-activeLine": { backgroundColor: "var(--hover)" },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
          backgroundColor: "var(--text-selection)",
        },
        ".cm-content ::selection": { backgroundColor: "var(--text-selection)" },
        ".cm-panels, .cm-tooltip": {
          backgroundColor: "var(--raised)",
          color: "var(--text)",
          borderColor: "var(--line)",
        },
      },
      { dark },
    ),
  ];
}
