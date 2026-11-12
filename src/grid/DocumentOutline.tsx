import { NavigationIcon } from "../NavigationIcon";
import { useEffect, useState } from "react";
import {
  pointer,
  type OutlineEntry,
  type OutlineResult,
  type Path,
} from "../document/engine";
type Props = {
  current: Path;
  revision: number;
  visible: boolean;
  disabled: boolean;
  load: (path: Path) => Promise<OutlineResult>;
  navigate: (path: Path) => void;
};
function Branch({ item, ...props }: Props & { item: OutlineEntry }) {
  const ancestor =
    item.path.length < props.current.length &&
    item.path.every((part, i) => props.current[i] === part);
  const current = JSON.stringify(item.path) === JSON.stringify(props.current);
  const [expanded, setExpanded] = useState(item.path.length === 0 || ancestor);
  const [result, setResult] = useState<OutlineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const currentKey = JSON.stringify(props.current);
  const pathKey = JSON.stringify(item.path);
  useEffect(() => {
    if (ancestor) setExpanded(true);
  }, [currentKey, ancestor]);
  useEffect(() => {
    if (!expanded || !props.visible || !item.expandable) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    void props
      .load(item.path)
      .then((value) => {
        if (!cancelled) setResult(value);
      })
      .catch((error) => {
        if (!cancelled)
          setError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, props.visible, props.revision, pathKey, item.expandable]);
  return (
    <li>
      <div className={`outline-entry ${current ? "active" : ""}`}>
        {item.expandable ? (
          <button
            className="outline-disclosure"
            aria-label={`${expanded ? "Collapse" : "Expand"} ${item.label}`}
            aria-expanded={expanded}
            disabled={props.disabled}
            onClick={() => setExpanded(!expanded)}
          >
            <NavigationIcon name="chevron" size={14} />
          </button>
        ) : (
          <span className="outline-disclosure" />
        )}
        <button
          className="outline-node"
          aria-current={current ? "location" : undefined}
          disabled={props.disabled}
          title={pointer(item.path) || "/"}
          onClick={() => props.navigate(item.path)}
        >
          <span className="node-icon">
            {item.kind === "array" ? "[ ]" : "{ }"}
          </span>
          <span className="tree-label">{item.label || "(empty key)"}</span>
        </button>
      </div>
      {expanded && (
        <ul>
          {result?.children.map((child) => (
            <Branch key={JSON.stringify(child.path)} {...props} item={child} />
          ))}
          {loading && !result && (
            <li className="outline-note" role="status">
              Loading…
            </li>
          )}
          {error && (
            <li className="outline-note" role="alert">
              {error}
            </li>
          )}
          {result?.truncated && (
            <li className="outline-note">
              First 200 nested tables shown. Open the parent table for all
              entries.
            </li>
          )}
        </ul>
      )}
    </li>
  );
}
export function DocumentOutline(
  props: Props & { rootKind: OutlineEntry["kind"] },
) {
  return (
    <nav aria-label="Document structure">
      <ul className="outline-tree">
        <Branch
          {...props}
          item={{
            label: "root",
            path: [],
            kind: props.rootKind,
            expandable: true,
          }}
        />
      </ul>
    </nav>
  );
}
