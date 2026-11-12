import {
  copySelection,
  pasteSelection,
  fillSelection,
} from "../document/selectionOperations";
import {
  DocumentEngine,
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
