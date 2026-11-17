import type { Diagnostic } from "../document/engine";

export function jsonProblem(text: string, diagnostics: Diagnostic[]) {
  if (!text.replace(/^\ufeff/, "").trim())
    return {
      title: "This document is empty.",
      message: "Choose another JSON file, or enter JSON in Source below.",
    };
  const issue = diagnostics[0];
  const messages: Record<string, string> = {
    ValueExpected: "A JSON value is missing.",
    PropertyNameExpected:
      "A property name is missing or is not in double quotes.",
    ColonExpected: "A colon is missing between a property name and its value.",
    CommaExpected: "A comma is missing between entries.",
    CloseBraceExpected: "An object is missing its closing brace (}).",
    CloseBracketExpected: "An array is missing its closing bracket (]).",
    EndOfFileExpected: "There is extra content after the JSON value.",
    InvalidCommentToken: "Comments are not allowed in JSON.",
    UnexpectedEndOfString: "A quoted value is not finished.",
  };
  return {
    title: messages[issue?.message] ?? "This document is not valid JSON.",
    message: `Check line ${issue?.line ?? 1}, column ${issue?.column ?? 1} in Source below, or choose another file.`,
  };
}
export function JsonProblem({
  text,
  diagnostics,
  onOpen,
}: {
  text: string;
  diagnostics: Diagnostic[];
  onOpen: () => void;
}) {
  const problem = jsonProblem(text, diagnostics);
  return (
    <section className="diagnostics" role="alert">
      <strong>{problem.title}</strong>
      <p>{problem.message}</p>
      <button onClick={onOpen}>Open another file…</button>
      <details>
        <summary>Technical details</summary>
        {diagnostics.slice(0, 5).map((d, i) => (
          <p key={i}>
            Line {d.line}, column {d.column}: {d.message.slice(0, 400)}
            {d.message.length > 400 ? "…" : ""}
          </p>
        ))}
      </details>
    </section>
  );
}
