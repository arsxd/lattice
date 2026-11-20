import { ColumnMenuChevron } from "../grid/SheetIcons";
import type { Diagnostic } from "../document/engine";

export function jsonDiagnosticTitle(message: string) {
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
    UnexpectedEndOfString: "A string is missing its closing double quote.",
  };
  return (
    messages[message] ??
    (message.startsWith("Duplicate key ")
      ? message
      : "This document is not valid JSON.")
  );
}
export function jsonProblem(text: string, diagnostics: Diagnostic[]) {
  if (!text.replace(/^\ufeff/, "").trim())
    return {
      title: "This document is empty.",
      message: "Enter JSON in Source below.",
    };
  const issue = diagnostics[0];

  return {
    title: jsonDiagnosticTitle(issue?.message ?? ""),
    message: `Check line ${issue?.line ?? 1}, column ${issue?.column ?? 1} in Source below.`,
  };
}
export function JsonProblem({
  text,
  diagnostics,
}: {
  text: string;
  diagnostics: Diagnostic[];
}) {
  const problem = jsonProblem(text, diagnostics);
  return (
    <section className="diagnostics" role="alert">
      <strong>{problem.title}</strong>
      <p>{problem.message}</p>
      <details>
        <summary>
          <ColumnMenuChevron />
          Error details
        </summary>
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
