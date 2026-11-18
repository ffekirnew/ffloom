import { SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Actor, PRIORITIES, Priority, who } from "./api";
import { DueFilter, Filters } from "./filters";
import { keyOf } from "./TaskModal";
import { Select } from "./ui";

// One button for the less-used filters, so the row stays search + project + this.
export function FilterMenu({ filters, agents, tags, onChange }: {
  filters: Filters;
  agents: Actor[];
  tags: string[];
  onChange: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = [filters.priority, filters.assignee, filters.tag, filters.due].filter(Boolean).length;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  return (
    <div className="filter-menu" ref={ref}>
      <button type="button" className={`btn ${count ? "set" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        <SlidersHorizontal size={15} />Filters{count > 0 && <span className="badge">{count}</span>}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Filters">
          <label>Priority
            <Select value={filters.priority} onChange={(e) => onChange("priority", e.target.value as Priority | "")}>
              <option value="">Any</option>
              {[...PRIORITIES].reverse().map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
            </Select>
          </label>
          <label>Assignee
            <Select value={filters.assignee} onChange={(e) => onChange("assignee", e.target.value)}>
              <option value="">Anyone</option>
              <option value="user">You</option>
              {agents.map((a) => <option key={keyOf(a)} value={keyOf(a)}>{who(a)}</option>)}
              <option value="none">Unassigned</option>
            </Select>
          </label>
          <label>Tag
            <Select value={filters.tag} onChange={(e) => onChange("tag", e.target.value)} disabled={tags.length === 0}>
              <option value="">Any</option>
              {tags.map((g) => <option key={g} value={g}>#{g}</option>)}
            </Select>
          </label>
          <label>Due
            <Select value={filters.due} onChange={(e) => onChange("due", e.target.value as DueFilter)}>
              <option value="">Any time</option>
              <option value="overdue">Overdue</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="none">No due date</option>
            </Select>
          </label>
          {count > 0 && (
            <button type="button" className="btn ghost" onClick={() => {
              onChange("priority", ""); onChange("assignee", ""); onChange("tag", ""); onChange("due", "");
            }}>Reset these</button>
          )}
        </div>
      )}
    </div>
  );
}
