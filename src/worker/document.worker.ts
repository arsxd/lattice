import { compactPrettyJson } from "../document/compactPrettyJson";
import { format, parseTree, type ParseError } from "jsonc-parser";
import {
  copySelection,
  pasteSelection,
  fillSelection,
} from "../document/selectionOperations";
import {
  DocumentEngine,
  PAGE_SIZE,
  type Query,
  type Mutation,
  type Path,
} from "../document/engine";
let engine: DocumentEngine | undefined;
self.onmessage = (event: MessageEvent) => {
  const { id, action, args } = event.data;
  try {
    let value: unknown;
    if (action === "open") {
      engine = new DocumentEngine(args.text);
      value = true;
    } else {
      if (!engine) throw new Error("Open a document first.");
      switch (action) {
        case "format-source": {
          const text: string = args.text;
          const bom = text.startsWith("\uFEFF") ? "\uFEFF" : "";
          const body = text.slice(bom.length);
          const errors: ParseError[] = [];
          const root = parseTree(body, errors, {
            disallowComments: true,
            allowTrailingComma: false,
          });
          if (!root || errors.length)
            throw new Error(
              "Correct the JSON before formatting. Your draft has been kept.",
            );
          if (args.action === "compact") {
            value =
              bom +
              compactPrettyJson(
                body,
                root,
                text.includes("\r\n") ? "\r\n" : "\n",
                args.baseIndent,
              );
          } else if (args.action === "minify") {
            value =
              bom +
              body.replace(/"(?:[^"\\]|\\[\s\S])*"|\s+/g, (token) =>
                token.startsWith('"') ? token : "",
              );
          } else {
            const edits = format(body, undefined, {
              tabSize: 2,
              insertSpaces: true,
              eol: text.includes("\r\n") ? "\r\n" : "\n",
            });
            // Join once; repeatedly splicing the full document is costly on large files.
            const parts = [bom];
            let offset = 0;
            for (const edit of edits.sort((a, b) => a.offset - b.offset)) {
              parts.push(body.slice(offset, edit.offset), edit.content);
              offset = edit.offset + edit.length;
            }
            parts.push(body.slice(offset));
            value = parts.join("");
          }
          break;
        }
        case "copy":
          value = copySelection(
            engine,
            args.query,
            args.selection,
            args.revision,
          );
          break;
        case "paste":
          pasteSelection(
            engine,
            args.query,
            args.selection,
            args.text,
            args.revision,
          );
          break;
        case "fill":
          fillSelection(engine, args.query, args.selection, args.revision);
          break;
        case "project":
          value = engine.project(args as Query);
          break;
        case "row-ids":
          value =
            engine.project(args.query, undefined, undefined, false, args.spans)
              .rowIds ?? [];
          break;
        case "locate-row": {
          const result = engine.project(
            args.query as Query,
            undefined,
            args.path as Path,
          );
          value = {
            row: result.locatedRow,
            page:
              result.locatedRow === undefined
                ? result.page
                : Math.floor(result.locatedRow / PAGE_SIZE),
          };
          break;
        }
        case "outline":
          value = engine.outline(args.path as Path);
          break;
        case "locate":
          value = engine.locate(args.path as Path, !!args.property);
          break;
        case "raw":
          value = engine.raw(args.path as Path);
          break;
        case "text":
          value = { text: engine.text, revision: engine.revision };
          break;
        case "mutate":
          engine.mutate(args.command as Mutation, args.revision);
          break;
        case "review-apply":
          engine.source(args.text, args.revision, true);
          break;
        case "source":
          engine.source(args.text, args.revision);
          break;
        case "undo":
          engine.undo();
          break;
        case "redo":
          engine.redo();
          break;
        case "saved":
          engine.markSaved(args.text);
          break;
        default:
          throw new Error("Unknown document command.");
      }
    }
    self.postMessage({ id, value });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
